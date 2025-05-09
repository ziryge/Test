import os
import subprocess
import logging
import shlex
import sys
from flask import Blueprint, request, jsonify

# Set up logging
logger = logging.getLogger(__name__)

# Create blueprint
terminal_bp = Blueprint('terminal', __name__)

# Define workspace directory (can be configured)
# Use the actual system's home directory for the AI workspace
WORKSPACE_DIR = os.environ.get('WORKSPACE_DIR', os.path.join(os.path.expanduser('~'), 'workspace/ai_workspace'))

# Ensure workspace directory exists
os.makedirs(WORKSPACE_DIR, exist_ok=True)

# Log the workspace directory
logger.info(f"AI workspace directory: {WORKSPACE_DIR}")

@terminal_bp.route('/execute', methods=['POST'])
def execute_command():
    """Execute a command in the terminal"""
    try:
        data = request.json
        if not data or 'command' not in data:
            return jsonify({"error": "Missing 'command' parameter"}), 400

        command = data['command']

        # Log the command being executed
        logger.info(f"Executing command: {command}")

        # Execute command in workspace directory using the real system terminal
        # This will use the actual system terminal with full capabilities
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=WORKSPACE_DIR,
            text=True,
            env=os.environ.copy()  # Use the current environment variables
        )

        # Get output with timeout
        try:
            stdout, stderr = process.communicate(timeout=60)  # Increased timeout for longer operations
            return_code = process.returncode
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
            return jsonify({
                "success": False,
                "error": "Command execution timed out",
                "stdout": stdout,
                "stderr": stderr,
                "return_code": -1
            }), 408

        # Log the command result
        logger.info(f"Command executed with return code: {return_code}")

        return jsonify({
            "success": return_code == 0,
            "stdout": stdout,
            "stderr": stderr,
            "return_code": return_code,
            "command": command
        })
    except Exception as e:
        logger.error(f"Error executing command: {str(e)}")
        return jsonify({"error": f"Failed to execute command: {str(e)}"}), 500

@terminal_bp.route('/execute-script', methods=['POST'])
def execute_script():
    """Execute a script file"""
    try:
        data = request.json
        if not data or 'path' not in data:
            return jsonify({"error": "Missing 'path' parameter"}), 400

        script_path = os.path.join(WORKSPACE_DIR, data['path'])

        # Check if script exists
        if not os.path.exists(script_path) or not os.path.isfile(script_path):
            return jsonify({"error": "Script not found"}), 404

        # Make script executable
        os.chmod(script_path, 0o755)

        # Execute script
        process = subprocess.Popen(
            script_path,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=WORKSPACE_DIR,
            text=True
        )

        # Get output with timeout
        try:
            stdout, stderr = process.communicate(timeout=30)
            return_code = process.returncode
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
            return jsonify({
                "success": False,
                "error": "Script execution timed out",
                "stdout": stdout,
                "stderr": stderr,
                "return_code": -1
            }), 408

        return jsonify({
            "success": return_code == 0,
            "stdout": stdout,
            "stderr": stderr,
            "return_code": return_code,
            "script": data['path']
        })
    except Exception as e:
        logger.error(f"Error executing script: {str(e)}")
        return jsonify({"error": f"Failed to execute script: {str(e)}"}), 500
