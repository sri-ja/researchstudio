
export const authService = {
  /**
   * Hashes a string using SHA-256.
   */
  async hashPassword(password: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  },

  /**
   * Compares a plain text password against a stored hash.
   */
  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const hash = await this.hashPassword(password);
    return hash === storedHash;
  }
};
