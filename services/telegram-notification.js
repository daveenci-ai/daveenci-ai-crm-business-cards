/**
 * Telegram Notification Service
 * Sends research summaries and business card notifications to Telegram
 */

const TelegramBot = require('node-telegram-bot-api');

class TelegramNotificationService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!this.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
    }
    
    if (!this.chatId) {
      throw new Error('TELEGRAM_CHAT_ID environment variable is required');
    }
    
    // Initialize bot without polling (we only need to send messages)
    this.bot = new TelegramBot(this.botToken, { polling: false });
  }

  /**
   * Send a new business card notification with research summary
   * @param {Object} contactData - Contact information
   * @param {Object} researchData - AI research results
   * @returns {Promise<void>}
   */
  async sendBusinessCardNotification(contactData, researchData) {
    try {
      console.log('📱 Sending Telegram notification...');
      
      const message = this.formatBusinessCardMessage(contactData, researchData);
      
      // Send message with HTML formatting
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: false
      });
      
      console.log('✅ Telegram notification sent successfully');
      
    } catch (error) {
      console.error('❌ Telegram notification error:', error);
      // Don't throw error - notification failure shouldn't stop the main process
    }
  }

  /**
   * Send a simple text notification
   * @param {string} message - Message to send
   * @returns {Promise<void>}
   */
  async sendSimpleNotification(message) {
    try {
      await this.bot.sendMessage(this.chatId, message);
      console.log('✅ Simple Telegram notification sent');
    } catch (error) {
      console.error('❌ Simple Telegram notification error:', error);
    }
  }

  /**
   * Format business card and research data into a Telegram message
   * @param {Object} contactData - Contact information
   * @param {Object} researchData - AI research results
   * @returns {string} Formatted message
   */
  formatBusinessCardMessage(contactData, researchData) {
    const { name, email, phone, company, industry, website } = contactData;
    
    // Start with business card info
    let message = `🔗 <b>New Business Card Scanned</b>\n\n`;
    
    // Contact details
    message += `👤 <b>Contact Details:</b>\n`;
    if (name) message += `• Name: ${this.escapeHtml(name)}\n`;
    if (company) message += `• Company: ${this.escapeHtml(company)}\n`;
    if (industry) message += `• Industry: ${this.escapeHtml(industry)}\n`;
    if (email) message += `• Email: ${this.escapeHtml(email)}\n`;
    if (phone) message += `• Phone: ${this.escapeHtml(phone)}\n`;
    if (website) message += `• Website: ${this.escapeHtml(website)}\n`;
    
    message += `\n`;
    
    // AI Research Summary
    if (researchData && researchData.success) {
      message += `🤖 <b>AI Research Summary:</b>\n`;
      message += `${this.escapeHtml(researchData.research_summary)}\n\n`;
      
      // Research quality indicator
      const qualityEmoji = {
        'high': '🟢',
        'medium': '🟡',
        'low': '🔴'
      };
      
      message += `📊 Research Quality: ${qualityEmoji[researchData.research_quality] || '⚪'} ${researchData.research_quality}\n`;
      
      // Key insights preview
      if (researchData.detailed_insights) {
        message += `\n💡 <b>Key Insights Available:</b>\n`;
        
        const insights = researchData.detailed_insights;
        if (insights.professional_background && insights.professional_background !== 'No specific information found in this category.') {
          message += `• Professional Background ✅\n`;
        }
        if (insights.company_analysis && insights.company_analysis !== 'No specific information found in this category.') {
          message += `• Company Analysis ✅\n`;
        }
        if (insights.business_opportunities && insights.business_opportunities !== 'No specific information found in this category.') {
          message += `• Business Opportunities ✅\n`;
        }
        if (insights.communication_strategy && insights.communication_strategy !== 'No specific information found in this category.') {
          message += `• Communication Strategy ✅\n`;
        }
      }
      
    } else {
      message += `⚠️ <b>AI Research:</b> ${researchData?.error || 'Failed'}\n`;
    }
    
    // Add timestamp
    message += `\n⏰ Processed: ${new Date().toLocaleString()}`;
    
    // Add CRM link or instructions
    message += `\n\n💼 View in CRM for detailed research insights`;
    
    return message;
  }

  /**
   * Send a test notification to verify setup
   * @returns {Promise<boolean>} Success status
   */
  async sendTestNotification() {
    try {
      const testMessage = `🧪 <b>Business Card CRM Test</b>\n\nTelegram integration is working correctly!\n\n⏰ ${new Date().toLocaleString()}`;
      
      await this.bot.sendMessage(this.chatId, testMessage, {
        parse_mode: 'HTML'
      });
      
      console.log('✅ Test notification sent successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Test notification failed:', error);
      return false;
    }
  }

  /**
   * Escape HTML special characters for Telegram
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Get bot information to verify connection
   * @returns {Promise<Object>} Bot information
   */
  async getBotInfo() {
    try {
      const botInfo = await this.bot.getMe();
      console.log('🤖 Bot info:', botInfo);
      return botInfo;
    } catch (error) {
      console.error('❌ Failed to get bot info:', error);
      throw error;
    }
  }
}

module.exports = TelegramNotificationService; 