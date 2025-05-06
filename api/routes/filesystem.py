import os
import subprocess
import logging
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename

# Set up logging
logger = logging.getLogger(__name__)

# Create blueprint
filesystem_bp = Blueprint('filesystem', __name__)

# Define workspace directory (can be configured)
WORKSPACE_DIR = os.environ.get('WORKSPACE_DIR', os.path.join(os.path.dirname(os.path.dirname(__file__)), 'workspace'))

# Ensure workspace directory exists
os.makedirs(WORKSPACE_DIR, exist_ok=True)

@filesystem_bp.route('/create', methods=['POST'])
def create_file():
    """Create a new file with the given content"""
    try:
        data = request.json
        if not data or 'path' not in data or 'content' not in data:
            return jsonify({"error": "Missing required parameters"}), 400

        # Secure the path to prevent directory traversal
        relative_path = secure_filename(data['path'])
        file_path = os.path.join(WORKSPACE_DIR, relative_path)
        
        # Create parent directories if they don't exist
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Check if file already exists
        if os.path.exists(file_path):
            return jsonify({"error": "File already exists"}), 409
        
        # Write content to file
        with open(file_path, 'w') as f:
            f.write(data['content'])
        
        return jsonify({
            "success": True,
            "message": f"File created at {relative_path}",
            "path": relative_path
        })
    except Exception as e:
        logger.error(f"Error creating file: {str(e)}")
        return jsonify({"error": f"Failed to create file: {str(e)}"}), 500

@filesystem_bp.route('/read', methods=['GET'])
def read_file():
    """Read a file from the given path"""
    try:
        path = request.args.get('path')
        if not path:
            return jsonify({"error": "Missing 'path' parameter"}), 400
        
        # Secure the path to prevent directory traversal
        relative_path = secure_filename(path)
        file_path = os.path.join(WORKSPACE_DIR, relative_path)
        
        # Check if file exists
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            return jsonify({"error": "File not found"}), 404
        
        # Read file content
        with open(file_path, 'r') as f:
            content = f.read()
        
        return jsonify({
            "success": True,
            "content": content,
            "path": relative_path
        })
    except Exception as e:
        logger.error(f"Error reading file: {str(e)}")
        return jsonify({"error": f"Failed to read file: {str(e)}"}), 500

@filesystem_bp.route('/update', methods=['PUT'])
def update_file():
    """Update a file with the given content"""
    try:
        data = request.json
        if not data or 'path' not in data or 'content' not in data:
            return jsonify({"error": "Missing required parameters"}), 400
        
        # Secure the path to prevent directory traversal
        relative_path = secure_filename(data['path'])
        file_path = os.path.join(WORKSPACE_DIR, relative_path)
        
        # Check if file exists
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            return jsonify({"error": "File not found"}), 404
        
        # Write content to file
        with open(file_path, 'w') as f:
            f.write(data['content'])
        
        return jsonify({
            "success": True,
            "message": f"File updated at {relative_path}",
            "path": relative_path
        })
    except Exception as e:
        logger.error(f"Error updating file: {str(e)}")
        return jsonify({"error": f"Failed to update file: {str(e)}"}), 500

@filesystem_bp.route('/delete', methods=['DELETE'])
def delete_file():
    """Delete a file at the given path"""
    try:
        path = request.args.get('path')
        if not path:
            return jsonify({"error": "Missing 'path' parameter"}), 400
        
        # Secure the path to prevent directory traversal
        relative_path = secure_filename(path)
        file_path = os.path.join(WORKSPACE_DIR, relative_path)
        
        # Check if file exists
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            return jsonify({"error": "File not found"}), 404
        
        # Delete file
        os.remove(file_path)
        
        return jsonify({
            "success": True,
            "message": f"File deleted at {relative_path}",
            "path": relative_path
        })
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        return jsonify({"error": f"Failed to delete file: {str(e)}"}), 500

@filesystem_bp.route('/list', methods=['GET'])
def list_files():
    """List files in a directory"""
    try:
        path = request.args.get('path', '')
        
        # Secure the path to prevent directory traversal
        relative_path = secure_filename(path) if path else ''
        dir_path = os.path.join(WORKSPACE_DIR, relative_path)
        
        # Check if directory exists
        if not os.path.exists(dir_path) or not os.path.isdir(dir_path):
            return jsonify({"error": "Directory not found"}), 404
        
        # List files and directories
        files = []
        directories = []
        
        for item in os.listdir(dir_path):
            item_path = os.path.join(dir_path, item)
            if os.path.isfile(item_path):
                files.append({
                    "name": item,
                    "path": os.path.join(relative_path, item),
                    "size": os.path.getsize(item_path),
                    "type": "file"
                })
            elif os.path.isdir(item_path):
                directories.append({
                    "name": item,
                    "path": os.path.join(relative_path, item),
                    "type": "directory"
                })
        
        return jsonify({
            "success": True,
            "path": relative_path,
            "files": files,
            "directories": directories
        })
    except Exception as e:
        logger.error(f"Error listing files: {str(e)}")
        return jsonify({"error": f"Failed to list files: {str(e)}"}), 500
