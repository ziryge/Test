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
# Use the actual system's home directory for the AI workspace
WORKSPACE_DIR = os.environ.get('WORKSPACE_DIR', os.path.join(os.path.expanduser('~'), 'workspace/ai_workspace'))

# Ensure workspace directory exists
os.makedirs(WORKSPACE_DIR, exist_ok=True)

# Log the workspace directory
logger.info(f"AI filesystem workspace directory: {WORKSPACE_DIR}")

@filesystem_bp.route('/create', methods=['POST'])
def create_file():
    """Create a new file with the given content"""
    try:
        data = request.json
        if not data or 'path' not in data or 'content' not in data:
            return jsonify({"error": "Missing required parameters"}), 400

        # Get the path and sanitize it
        path = data['path']
        # Allow paths with slashes but prevent directory traversal
        path = path.replace('../', '').replace('..\\', '')

        # Construct the full file path
        file_path = os.path.join(WORKSPACE_DIR, path)

        # Create parent directories if they don't exist
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        # Check if file already exists
        if os.path.exists(file_path):
            # Overwrite existing file if requested
            if data.get('overwrite', False):
                logger.info(f"Overwriting existing file at {file_path}")
            else:
                return jsonify({"error": "File already exists"}), 409

        # Write content to file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(data['content'])

        logger.info(f"File created at {file_path}")

        return jsonify({
            "success": True,
            "message": f"File created at {path}",
            "path": path,
            "full_path": file_path
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

        # Allow paths with slashes but prevent directory traversal
        path = path.replace('../', '').replace('..\\', '')

        # Construct the full file path
        file_path = os.path.join(WORKSPACE_DIR, path)

        # Check if file exists
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            return jsonify({"error": "File not found"}), 404

        # Determine file type for proper reading mode
        try:
            # Try to read as text
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            file_type = 'text'
        except UnicodeDecodeError:
            # If it fails, read as binary and encode to base64
            with open(file_path, 'rb') as f:
                binary_content = f.read()
                import base64
                content = base64.b64encode(binary_content).decode('utf-8')
            file_type = 'binary'

        # Get file stats
        file_stats = os.stat(file_path)

        logger.info(f"File read from {file_path}")

        return jsonify({
            "success": True,
            "content": content,
            "path": path,
            "full_path": file_path,
            "file_type": file_type,
            "size": file_stats.st_size,
            "modified": file_stats.st_mtime
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

        # Get the path and sanitize it
        path = data['path']
        # Allow paths with slashes but prevent directory traversal
        path = path.replace('../', '').replace('..\\', '')

        # Construct the full file path
        file_path = os.path.join(WORKSPACE_DIR, path)

        # Check if file exists
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            # Create the file if it doesn't exist and create_if_missing is True
            if data.get('create_if_missing', False):
                # Create parent directories if they don't exist
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                logger.info(f"Creating new file at {file_path}")
            else:
                return jsonify({"error": "File not found"}), 404

        # Write content to file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(data['content'])

        logger.info(f"File updated at {file_path}")

        return jsonify({
            "success": True,
            "message": f"File updated at {path}",
            "path": path,
            "full_path": file_path
        })
    except Exception as e:
        logger.error(f"Error updating file: {str(e)}")
        return jsonify({"error": f"Failed to update file: {str(e)}"}), 500

@filesystem_bp.route('/delete', methods=['DELETE'])
def delete_file():
    """Delete a file or directory at the given path"""
    try:
        path = request.args.get('path')
        if not path:
            return jsonify({"error": "Missing 'path' parameter"}), 400

        # Allow paths with slashes but prevent directory traversal
        path = path.replace('../', '').replace('..\\', '')

        # Construct the full file path
        file_path = os.path.join(WORKSPACE_DIR, path)

        # Check if path exists
        if not os.path.exists(file_path):
            return jsonify({"error": "Path not found"}), 404

        # Handle file or directory deletion
        if os.path.isfile(file_path):
            # Delete file
            os.remove(file_path)
            logger.info(f"File deleted at {file_path}")
            item_type = "file"
        elif os.path.isdir(file_path):
            # Check if recursive deletion is requested
            recursive = request.args.get('recursive', 'false').lower() == 'true'

            if recursive:
                # Delete directory and all contents
                import shutil
                shutil.rmtree(file_path)
                logger.info(f"Directory and contents deleted at {file_path}")
            else:
                # Try to delete empty directory
                try:
                    os.rmdir(file_path)
                    logger.info(f"Empty directory deleted at {file_path}")
                except OSError:
                    return jsonify({
                        "error": "Directory is not empty. Use recursive=true to delete non-empty directories."
                    }), 400

            item_type = "directory"

        return jsonify({
            "success": True,
            "message": f"{item_type.capitalize()} deleted at {path}",
            "path": path,
            "full_path": file_path,
            "type": item_type
        })
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        return jsonify({"error": f"Failed to delete file: {str(e)}"}), 500

@filesystem_bp.route('/list', methods=['GET'])
def list_files():
    """List files in a directory"""
    try:
        path = request.args.get('path', '')

        # Allow paths with slashes but prevent directory traversal
        path = path.replace('../', '').replace('..\\', '')

        # Construct the full directory path
        dir_path = os.path.join(WORKSPACE_DIR, path)

        # Check if directory exists
        if not os.path.exists(dir_path) or not os.path.isdir(dir_path):
            # Create the directory if it doesn't exist and create_if_missing is True
            create_if_missing = request.args.get('create_if_missing', 'false').lower() == 'true'
            if create_if_missing:
                os.makedirs(dir_path, exist_ok=True)
                logger.info(f"Created directory at {dir_path}")
            else:
                return jsonify({"error": "Directory not found"}), 404

        # List files and directories
        files = []
        directories = []

        for item in os.listdir(dir_path):
            item_path = os.path.join(dir_path, item)
            rel_path = os.path.join(path, item) if path else item

            # Get file/directory stats
            stats = os.stat(item_path)

            if os.path.isfile(item_path):
                # Determine if the file is binary or text
                try:
                    with open(item_path, 'r', encoding='utf-8') as f:
                        f.read(1024)  # Try to read a small part
                    file_type = 'text'
                except UnicodeDecodeError:
                    file_type = 'binary'
                except:
                    file_type = 'unknown'

                files.append({
                    "name": item,
                    "path": rel_path,
                    "full_path": item_path,
                    "size": stats.st_size,
                    "modified": stats.st_mtime,
                    "type": "file",
                    "file_type": file_type
                })
            elif os.path.isdir(item_path):
                directories.append({
                    "name": item,
                    "path": rel_path,
                    "full_path": item_path,
                    "modified": stats.st_mtime,
                    "type": "directory"
                })

        logger.info(f"Listed directory contents at {dir_path}")

        return jsonify({
            "success": True,
            "path": path,
            "full_path": dir_path,
            "files": files,
            "directories": directories,
            "total_files": len(files),
            "total_directories": len(directories)
        })
    except Exception as e:
        logger.error(f"Error listing files: {str(e)}")
        return jsonify({"error": f"Failed to list files: {str(e)}"}), 500
