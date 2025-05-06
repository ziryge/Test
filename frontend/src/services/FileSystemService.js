import ApiService from './ApiService';

/**
 * Service for handling file system operations
 */
class FileSystemService {
  /**
   * Create a new file with the given content
   * @param {string} path - The file path
   * @param {string} content - The file content
   * @returns {Promise<Object>} - The response from the server
   */
  async createFile(path, content) {
    try {
      const response = await ApiService.client.post('/filesystem/create', {
        path,
        content
      });
      return response.data;
    } catch (error) {
      console.error('Error creating file:', error);
      throw error;
    }
  }

  /**
   * Read a file from the given path
   * @param {string} path - The file path
   * @returns {Promise<Object>} - The response from the server
   */
  async readFile(path) {
    try {
      const response = await ApiService.client.get('/filesystem/read', {
        params: { path }
      });
      return response.data;
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  }

  /**
   * Update a file with the given content
   * @param {string} path - The file path
   * @param {string} content - The new file content
   * @returns {Promise<Object>} - The response from the server
   */
  async updateFile(path, content) {
    try {
      const response = await ApiService.client.put('/filesystem/update', {
        path,
        content
      });
      return response.data;
    } catch (error) {
      console.error('Error updating file:', error);
      throw error;
    }
  }

  /**
   * Delete a file at the given path
   * @param {string} path - The file path
   * @returns {Promise<Object>} - The response from the server
   */
  async deleteFile(path) {
    try {
      const response = await ApiService.client.delete('/filesystem/delete', {
        params: { path }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * List files in a directory
   * @param {string} path - The directory path
   * @returns {Promise<Object>} - The response from the server
   */
  async listFiles(path) {
    try {
      const response = await ApiService.client.get('/filesystem/list', {
        params: { path }
      });
      return response.data;
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  /**
   * Execute a command in the terminal
   * @param {string} command - The command to execute
   * @returns {Promise<Object>} - The response from the server
   */
  async executeCommand(command) {
    try {
      const response = await ApiService.client.post('/terminal/execute', {
        command
      });
      return response.data;
    } catch (error) {
      console.error('Error executing command:', error);
      throw error;
    }
  }

  /**
   * Take a screenshot of a website
   * @param {string} url - The URL to screenshot
   * @returns {Promise<Object>} - The response from the server with the screenshot data
   */
  async takeScreenshot(url) {
    try {
      const response = await ApiService.client.post('/browser/screenshot', {
        url
      });
      return response.data;
    } catch (error) {
      console.error('Error taking screenshot:', error);
      throw error;
    }
  }

  /**
   * Browse a website and extract information
   * @param {string} url - The URL to browse
   * @returns {Promise<Object>} - The response from the server with the extracted data
   */
  async browseWebsite(url) {
    try {
      const response = await ApiService.client.post('/browser/browse', {
        url
      });
      return response.data;
    } catch (error) {
      console.error('Error browsing website:', error);
      throw error;
    }
  }
}

export default new FileSystemService();
