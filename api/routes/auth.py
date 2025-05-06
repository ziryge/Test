import os
import json
import logging
import secrets
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, session, redirect, url_for
import requests
from oauthlib.oauth2 import WebApplicationClient
from functools import wraps

# Configure logging
logger = logging.getLogger(__name__)

# Create blueprint
auth_bp = Blueprint('auth', __name__)

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "your-google-client-id")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "your-google-client-secret")
GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"

# OAuth client setup
client = WebApplicationClient(GOOGLE_CLIENT_ID)

# Session configuration
SESSION_SECRET = os.environ.get("SESSION_SECRET", secrets.token_hex(32))
SESSION_LIFETIME = int(os.environ.get("SESSION_LIFETIME", 86400))  # 24 hours by default

# User database (in-memory for demo purposes)
# In a real application, you would use a database
users = {}

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

# Get Google provider configuration
def get_google_provider_cfg():
    try:
        return requests.get(GOOGLE_DISCOVERY_URL).json()
    except Exception as e:
        logger.error(f"Error fetching Google provider config: {str(e)}")
        return None

# Google OAuth login URL
@auth_bp.route("/google/url", methods=["GET"])
def get_google_login_url():
    # Find out what URL to hit for Google login
    google_provider_cfg = get_google_provider_cfg()
    if not google_provider_cfg:
        return jsonify({"error": "Failed to fetch Google provider configuration"}), 500
    
    # Get the authorization endpoint
    authorization_endpoint = google_provider_cfg["authorization_endpoint"]
    
    # Use the library to construct the request for Google login
    redirect_uri = request.host_url.rstrip('/') + "/api/auth/google/callback"
    
    # Prepare the request
    request_uri = client.prepare_request_uri(
        authorization_endpoint,
        redirect_uri=redirect_uri,
        scope=["openid", "email", "profile"],
    )
    
    return jsonify({"authUrl": request_uri})

# Google OAuth callback
@auth_bp.route("/google/callback", methods=["POST"])
def google_callback():
    # Get the authorization code from the request
    code = request.json.get("code")
    if not code:
        return jsonify({"error": "Authorization code is required"}), 400
    
    # Get Google provider configuration
    google_provider_cfg = get_google_provider_cfg()
    if not google_provider_cfg:
        return jsonify({"error": "Failed to fetch Google provider configuration"}), 500
    
    # Get the token endpoint
    token_endpoint = google_provider_cfg["token_endpoint"]
    
    # Prepare the token request
    redirect_uri = request.host_url.rstrip('/') + "/api/auth/google/callback"
    
    try:
        # Exchange code for token
        token_url, headers, body = client.prepare_token_request(
            token_endpoint,
            authorization_response=f"?code={code}",
            redirect_url=redirect_uri,
            code=code
        )
        
        token_response = requests.post(
            token_url,
            headers=headers,
            data=body,
            auth=(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET),
        )
        
        # Parse the token response
        client.parse_request_body_response(json.dumps(token_response.json()))
        
        # Get user info from Google
        userinfo_endpoint = google_provider_cfg["userinfo_endpoint"]
        uri, headers, body = client.add_token(userinfo_endpoint)
        userinfo_response = requests.get(uri, headers=headers, data=body)
        
        # Verify the user info
        if userinfo_response.json().get("email_verified"):
            unique_id = userinfo_response.json()["sub"]
            user_email = userinfo_response.json()["email"]
            user_name = userinfo_response.json().get("name", "")
            user_picture = userinfo_response.json().get("picture", "")
            
            # Create or update user
            user = {
                "id": unique_id,
                "email": user_email,
                "name": user_name,
                "picture": user_picture,
                "last_login": datetime.now().isoformat()
            }
            
            users[unique_id] = user
            
            # Set session
            session.permanent = True
            session['user_id'] = unique_id
            
            return jsonify(user)
        else:
            return jsonify({"error": "User email not verified by Google"}), 400
            
    except Exception as e:
        logger.error(f"Error in Google callback: {str(e)}")
        return jsonify({"error": f"Failed to authenticate with Google: {str(e)}"}), 500

# Verify session
@auth_bp.route("/verify", methods=["GET"])
@login_required
def verify_session():
    user_id = session.get('user_id')
    if user_id and user_id in users:
        return jsonify(users[user_id])
    return jsonify({"error": "Invalid session"}), 401

# Logout
@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.pop('user_id', None)
    return jsonify({"message": "Logged out successfully"})

# Get current user
@auth_bp.route("/user", methods=["GET"])
@login_required
def get_current_user():
    user_id = session.get('user_id')
    if user_id and user_id in users:
        return jsonify(users[user_id])
    return jsonify({"error": "User not found"}), 404
