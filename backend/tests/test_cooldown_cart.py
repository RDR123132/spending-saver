"""
Backend API Tests for CoolDown Cart
Tests: Auth, Purchases CRUD, Chat, Settings
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
TEST_TOKEN = 'test_session_token_123'


@pytest.fixture
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TEST_TOKEN}"
    })
    return session


@pytest.fixture
def api_client_no_auth():
    """Requests session without auth"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestAuth:
    """Authentication endpoint tests"""

    def test_auth_me_without_token_returns_401(self, api_client_no_auth):
        """GET /api/auth/me should return 401 without auth"""
        response = api_client_no_auth.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "authenticated" in data["detail"].lower()

    def test_auth_me_with_valid_token_returns_user(self, api_client):
        """GET /api/auth/me should return user data with valid token"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        
        user = response.json()
        assert "user_id" in user
        assert user["user_id"] == "test_user_1"
        assert "email" in user
        assert user["email"] == "test@example.com"
        assert "name" in user
        assert user["name"] == "Test User"
        assert "settings" in user
        assert "_id" not in user  # MongoDB _id should be excluded


class TestPurchases:
    """Purchase CRUD tests"""

    def test_create_purchase_with_ai_waiting_period(self, api_client):
        """POST /api/purchases should create purchase with AI-generated waiting period"""
        payload = {
            "item_name": "TEST_Wireless Headphones",
            "cost": 150.00
        }
        response = api_client.post(f"{BASE_URL}/api/purchases", json=payload)
        assert response.status_code == 200
        
        purchase = response.json()
        assert "purchase_id" in purchase
        assert purchase["item_name"] == payload["item_name"]
        assert purchase["cost"] == payload["cost"]
        assert "waiting_hours" in purchase
        assert purchase["waiting_hours"] > 0
        assert "waiting_reason" in purchase
        assert len(purchase["waiting_reason"]) > 0
        assert "created_at" in purchase
        assert "expires_at" in purchase
        assert purchase["status"] == "waiting"
        assert "_id" not in purchase
        
        # Store for later tests
        pytest.test_purchase_id = purchase["purchase_id"]
        
        # Verify persistence with GET
        get_response = api_client.get(f"{BASE_URL}/api/purchases")
        assert get_response.status_code == 200
        purchases = get_response.json()
        assert any(p["purchase_id"] == purchase["purchase_id"] for p in purchases)

    def test_create_purchase_requires_auth(self, api_client_no_auth):
        """POST /api/purchases should require authentication"""
        payload = {"item_name": "Test Item", "cost": 50}
        response = api_client_no_auth.post(f"{BASE_URL}/api/purchases", json=payload)
        assert response.status_code == 401

    def test_create_purchase_validates_input(self, api_client):
        """POST /api/purchases should validate required fields"""
        # Missing item_name
        response = api_client.post(f"{BASE_URL}/api/purchases", json={"cost": 50})
        assert response.status_code == 400
        
        # Missing cost
        response = api_client.post(f"{BASE_URL}/api/purchases", json={"item_name": "Test"})
        assert response.status_code == 400
        
        # Invalid cost (negative)
        response = api_client.post(f"{BASE_URL}/api/purchases", json={"item_name": "Test", "cost": -10})
        assert response.status_code == 400

    def test_list_active_purchases(self, api_client):
        """GET /api/purchases should return active purchases"""
        response = api_client.get(f"{BASE_URL}/api/purchases")
        assert response.status_code == 200
        
        purchases = response.json()
        assert isinstance(purchases, list)
        for purchase in purchases:
            assert purchase["status"] == "waiting"
            assert "purchase_id" in purchase
            assert "item_name" in purchase
            assert "cost" in purchase
            assert "_id" not in purchase

    def test_list_purchases_requires_auth(self, api_client_no_auth):
        """GET /api/purchases should require authentication"""
        response = api_client_no_auth.get(f"{BASE_URL}/api/purchases")
        assert response.status_code == 401

    def test_get_purchase_history(self, api_client):
        """GET /api/purchases/history should return completed purchases"""
        response = api_client.get(f"{BASE_URL}/api/purchases/history")
        assert response.status_code == 200
        
        purchases = response.json()
        assert isinstance(purchases, list)
        for purchase in purchases:
            assert purchase["status"] in ["bought", "skipped"]
            assert "_id" not in purchase

    def test_decide_purchase_mark_as_skipped(self, api_client):
        """PATCH /api/purchases/{id}/decide should mark purchase as skipped"""
        # First create a purchase
        create_response = api_client.post(f"{BASE_URL}/api/purchases", json={
            "item_name": "TEST_Decide_Skipped",
            "cost": 25
        })
        assert create_response.status_code == 200
        purchase_id = create_response.json()["purchase_id"]
        
        # Mark as skipped
        decide_response = api_client.patch(
            f"{BASE_URL}/api/purchases/{purchase_id}/decide",
            json={"decision": "skipped"}
        )
        assert decide_response.status_code == 200
        
        # Verify it's in history
        history_response = api_client.get(f"{BASE_URL}/api/purchases/history")
        assert history_response.status_code == 200
        history = history_response.json()
        assert any(p["purchase_id"] == purchase_id and p["status"] == "skipped" for p in history)

    def test_decide_purchase_mark_as_bought(self, api_client):
        """PATCH /api/purchases/{id}/decide should mark purchase as bought"""
        # First create a purchase
        create_response = api_client.post(f"{BASE_URL}/api/purchases", json={
            "item_name": "TEST_Decide_Bought",
            "cost": 75
        })
        assert create_response.status_code == 200
        purchase_id = create_response.json()["purchase_id"]
        
        # Mark as bought
        decide_response = api_client.patch(
            f"{BASE_URL}/api/purchases/{purchase_id}/decide",
            json={"decision": "bought"}
        )
        assert decide_response.status_code == 200
        
        # Verify it's in history
        history_response = api_client.get(f"{BASE_URL}/api/purchases/history")
        assert history_response.status_code == 200
        history = history_response.json()
        assert any(p["purchase_id"] == purchase_id and p["status"] == "bought" for p in history)

    def test_decide_purchase_validates_decision(self, api_client):
        """PATCH /api/purchases/{id}/decide should validate decision value"""
        # Create a purchase first
        create_response = api_client.post(f"{BASE_URL}/api/purchases", json={
            "item_name": "TEST_Invalid_Decision",
            "cost": 30
        })
        purchase_id = create_response.json()["purchase_id"]
        
        # Try invalid decision
        response = api_client.patch(
            f"{BASE_URL}/api/purchases/{purchase_id}/decide",
            json={"decision": "invalid"}
        )
        assert response.status_code == 400

    def test_decide_nonexistent_purchase_returns_404(self, api_client):
        """PATCH /api/purchases/{id}/decide should return 404 for nonexistent purchase"""
        response = api_client.patch(
            f"{BASE_URL}/api/purchases/nonexistent_id/decide",
            json={"decision": "skipped"}
        )
        assert response.status_code == 404


class TestChat:
    """Chat endpoint tests"""

    def test_send_chat_message_and_get_ai_response(self, api_client):
        """POST /api/chat/{purchase_id} should send message and return AI response"""
        # First create a purchase
        create_response = api_client.post(f"{BASE_URL}/api/purchases", json={
            "item_name": "TEST_Chat_Item",
            "cost": 100
        })
        purchase_id = create_response.json()["purchase_id"]
        
        # Send chat message
        chat_response = api_client.post(
            f"{BASE_URL}/api/chat/{purchase_id}",
            json={"message": "I really need this item for work"}
        )
        assert chat_response.status_code == 200
        
        data = chat_response.json()
        assert "user_message" in data
        assert "ai_message" in data
        
        user_msg = data["user_message"]
        assert user_msg["role"] == "user"
        assert user_msg["content"] == "I really need this item for work"
        assert "message_id" in user_msg
        assert "_id" not in user_msg
        
        ai_msg = data["ai_message"]
        assert ai_msg["role"] == "assistant"
        assert len(ai_msg["content"]) > 0
        assert "message_id" in ai_msg
        assert "_id" not in ai_msg
        
        # Store for next test
        pytest.test_chat_purchase_id = purchase_id

    def test_get_chat_history(self, api_client):
        """GET /api/chat/{purchase_id} should return chat history"""
        # Use purchase from previous test or create new one
        if hasattr(pytest, 'test_chat_purchase_id'):
            purchase_id = pytest.test_chat_purchase_id
        else:
            create_response = api_client.post(f"{BASE_URL}/api/purchases", json={
                "item_name": "TEST_Chat_History",
                "cost": 50
            })
            purchase_id = create_response.json()["purchase_id"]
            # Send a message first
            api_client.post(
                f"{BASE_URL}/api/chat/{purchase_id}",
                json={"message": "Test message"}
            )
        
        # Get chat history
        response = api_client.get(f"{BASE_URL}/api/chat/{purchase_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "messages" in data
        assert "purchase" in data
        assert isinstance(data["messages"], list)
        assert len(data["messages"]) > 0
        
        for msg in data["messages"]:
            assert "message_id" in msg
            assert "role" in msg
            assert msg["role"] in ["user", "assistant"]
            assert "content" in msg
            assert "_id" not in msg

    def test_chat_requires_auth(self, api_client_no_auth):
        """Chat endpoints should require authentication"""
        response = api_client_no_auth.post(
            f"{BASE_URL}/api/chat/test_id",
            json={"message": "test"}
        )
        assert response.status_code == 401
        
        response = api_client_no_auth.get(f"{BASE_URL}/api/chat/test_id")
        assert response.status_code == 401

    def test_chat_with_nonexistent_purchase_returns_404(self, api_client):
        """Chat endpoints should return 404 for nonexistent purchase"""
        response = api_client.post(
            f"{BASE_URL}/api/chat/nonexistent_purchase",
            json={"message": "test"}
        )
        assert response.status_code == 404

    def test_chat_validates_message(self, api_client):
        """POST /api/chat should validate message field"""
        # Create purchase first
        create_response = api_client.post(f"{BASE_URL}/api/purchases", json={
            "item_name": "TEST_Chat_Validation",
            "cost": 40
        })
        purchase_id = create_response.json()["purchase_id"]
        
        # Try empty message
        response = api_client.post(
            f"{BASE_URL}/api/chat/{purchase_id}",
            json={"message": ""}
        )
        assert response.status_code == 400


class TestSettings:
    """User settings tests"""

    def test_get_user_settings(self, api_client):
        """GET /api/user/settings should return user settings"""
        response = api_client.get(f"{BASE_URL}/api/user/settings")
        assert response.status_code == 200
        
        data = response.json()
        assert "settings" in data
        assert isinstance(data["settings"], dict)
        assert "theme" in data["settings"]

    def test_update_user_settings(self, api_client):
        """PUT /api/user/settings should update settings"""
        new_settings = {"theme": "dark"}
        response = api_client.put(
            f"{BASE_URL}/api/user/settings",
            json={"settings": new_settings}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["settings"]["theme"] == "dark"
        
        # Verify persistence
        get_response = api_client.get(f"{BASE_URL}/api/user/settings")
        assert get_response.status_code == 200
        assert get_response.json()["settings"]["theme"] == "dark"
        
        # Reset to light
        api_client.put(
            f"{BASE_URL}/api/user/settings",
            json={"settings": {"theme": "light"}}
        )

    def test_settings_require_auth(self, api_client_no_auth):
        """Settings endpoints should require authentication"""
        response = api_client_no_auth.get(f"{BASE_URL}/api/user/settings")
        assert response.status_code == 401
        
        response = api_client_no_auth.put(
            f"{BASE_URL}/api/user/settings",
            json={"settings": {"theme": "dark"}}
        )
        assert response.status_code == 401


class TestCleanup:
    """Cleanup test data"""

    def test_cleanup_test_purchases(self, api_client):
        """Delete all test purchases created during testing"""
        # Get all purchases
        response = api_client.get(f"{BASE_URL}/api/purchases")
        if response.status_code == 200:
            purchases = response.json()
            for purchase in purchases:
                if purchase["item_name"].startswith("TEST_"):
                    requests.delete(
                        f"{BASE_URL}/api/purchases/{purchase['purchase_id']}",
                        headers={"Authorization": f"Bearer {TEST_TOKEN}"}
                    )
        
        # Get history and clean up
        response = api_client.get(f"{BASE_URL}/api/purchases/history")
        if response.status_code == 200:
            purchases = response.json()
            for purchase in purchases:
                if purchase["item_name"].startswith("TEST_"):
                    requests.delete(
                        f"{BASE_URL}/api/purchases/{purchase['purchase_id']}",
                        headers={"Authorization": f"Bearer {TEST_TOKEN}"}
                    )
        
        print("Test data cleanup completed")
