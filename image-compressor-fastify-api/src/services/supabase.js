const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
  constructor(config) {
    this.config = config;
    this.client = createClient(config.supabase.url, config.supabase.key);
    this.bucket = config.supabase.bucket;
    this.uploadPath = config.supabase.uploadPath;
  }

  /**
   * Upload file to Supabase Storage
   * @param {Buffer} buffer - File buffer
   * @param {string} filename - File name
   * @param {string} contentType - File content type
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(buffer, filename, contentType) {
    const filePath = `${this.uploadPath}/${filename}`;

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .upload(filePath, buffer, {
        contentType,
        upsert: true
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    // Get public URL for the uploaded file
    const { data: { publicUrl } } = this.client.storage
      .from(this.bucket)
      .getPublicUrl(filePath);

    return {
      key: data.path,
      url: publicUrl,
      size: buffer.length,
      contentType
    };
  }

  /**
   * Delete file from Supabase Storage
   * @param {string} filePath - Path to the file in the bucket
   * @returns {Promise<void>}
   */
  async deleteFile(filePath) {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([filePath]);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }
  }

  /**
   * List files in a directory
   * @param {string} prefix - Directory prefix
   * @returns {Promise<Array>} List of files
   */
  async listFiles(prefix = '') {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(prefix);

    if (error) {
      throw new Error(`Supabase list failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Get file metadata
   * @param {string} filePath - Path to the file in the bucket
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(filePath) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list('', {
        limit: 1,
        offset: 0,
        search: filePath
      });

    if (error) {
      throw new Error(`Supabase metadata fetch failed: ${error.message}`);
    }

    return data[0];
  }
}

module.exports = SupabaseService; 