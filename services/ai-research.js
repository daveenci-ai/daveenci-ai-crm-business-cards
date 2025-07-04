/**
 * AI Research Service using Google Gemini
 * Researches people based on business card information
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIResearchService {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Research a person based on their business card information
   * @param {Object} contactData - The contact information from business card
   * @returns {Promise<Object>} Research results
   */
  async researchPerson(contactData) {
    try {
      console.log('🔍 Starting AI research for:', contactData.name);
      
      const researchPrompt = this.buildResearchPrompt(contactData);
      console.log('📝 Research prompt created');
      
      const result = await this.model.generateContent(researchPrompt);
      const response = await result.response;
      const researchText = response.text();
      
      console.log('✅ AI research completed');
      
      // Parse and structure the research results
      const structuredResearch = this.parseResearchResults(researchText, contactData);
      
      return structuredResearch;
      
    } catch (error) {
      console.error('❌ AI research error:', error);
      return {
        success: false,
        error: error.message,
        research_summary: 'AI research failed - contact saved without research data',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Build a comprehensive research prompt for Gemini
   * @param {Object} contactData - Contact information
   * @returns {string} Research prompt
   */
  buildResearchPrompt(contactData) {
    const { name, email, phone, company, industry, website } = contactData;
    
    return `
You are a professional business researcher. I need you to research the following person based on their business card information. Please provide insights that would be valuable for business relationship building and CRM purposes.

CONTACT INFORMATION:
- Name: ${name || 'Not provided'}
- Email: ${email || 'Not provided'}
- Phone: ${phone || 'Not provided'}
- Company: ${company || 'Not provided'}
- Industry: ${industry || 'Not provided'}
- Website: ${website || 'Not provided'}

RESEARCH TASKS:
1. **Professional Background**: Research their current role, previous experience, and career trajectory
2. **Company Analysis**: Analyze their company's business model, market position, recent news, and key services/products
3. **Industry Insights**: Provide context about their industry, trends, challenges, and opportunities
4. **Business Opportunities**: Suggest potential collaboration opportunities or business synergies
5. **Communication Strategy**: Recommend how to approach this contact and what topics might interest them
6. **Recent Activities**: Look for recent professional activities, publications, speaking engagements, or company announcements

RESPONSE FORMAT:
Please structure your response as a comprehensive business intelligence report with clear sections. Focus on actionable insights that would help in building a business relationship. Be professional and factual.

If you cannot find specific information about the person, focus on what you can determine about their company and industry instead.

Important: Only provide information that could reasonably be found through public professional sources. Do not make assumptions or provide unverified information.
    `.trim();
  }

  /**
   * Parse and structure the research results from Gemini
   * @param {string} researchText - Raw research text from Gemini
   * @param {Object} contactData - Original contact data
   * @returns {Object} Structured research results
   */
  parseResearchResults(researchText, contactData) {
    // Extract key insights using basic pattern matching
    const insights = {
      professional_background: this.extractSection(researchText, ['professional background', 'career', 'experience']),
      company_analysis: this.extractSection(researchText, ['company analysis', 'company', 'business model']),
      industry_insights: this.extractSection(researchText, ['industry insights', 'industry', 'market']),
      business_opportunities: this.extractSection(researchText, ['business opportunities', 'opportunities', 'collaboration']),
      communication_strategy: this.extractSection(researchText, ['communication strategy', 'approach', 'topics']),
      recent_activities: this.extractSection(researchText, ['recent activities', 'recent', 'news', 'announcements'])
    };

    // Generate a concise summary
    const summary = this.generateSummary(researchText, contactData);

    return {
      success: true,
      contact_info: {
        name: contactData.name,
        company: contactData.company,
        industry: contactData.industry
      },
      research_summary: summary,
      detailed_insights: insights,
      full_research: researchText,
      timestamp: new Date().toISOString(),
      research_quality: this.assessResearchQuality(researchText)
    };
  }

  /**
   * Extract specific sections from research text
   * @param {string} text - Full research text
   * @param {Array} keywords - Keywords to look for
   * @returns {string} Extracted section
   */
  extractSection(text, keywords) {
    const lines = text.split('\n');
    let sectionLines = [];
    let inSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      
      // Check if this line contains any of our keywords
      const hasKeyword = keywords.some(keyword => line.includes(keyword.toLowerCase()));
      
      if (hasKeyword && (line.includes(':') || line.includes('#') || line.includes('**'))) {
        inSection = true;
        sectionLines.push(lines[i]);
        continue;
      }
      
      if (inSection) {
        // Stop if we hit another section header
        if ((line.includes(':') || line.includes('#') || line.includes('**')) && 
            !keywords.some(keyword => line.includes(keyword.toLowerCase()))) {
          break;
        }
        sectionLines.push(lines[i]);
      }
    }

    return sectionLines.join('\n').trim() || 'No specific information found in this category.';
  }

  /**
   * Generate a concise summary of the research
   * @param {string} researchText - Full research text
   * @param {Object} contactData - Contact information
   * @returns {string} Summary
   */
  generateSummary(researchText, contactData) {
    const name = contactData.name || 'Contact';
    const company = contactData.company || 'their company';
    
    // Extract first 2-3 sentences that seem most relevant
    const sentences = researchText.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const summary = sentences.slice(0, 3).join('. ').trim();
    
    if (summary.length > 200) {
      return summary.substring(0, 200) + '...';
    }
    
    return summary || `Research completed for ${name} at ${company}. See detailed insights for full analysis.`;
  }

  /**
   * Assess the quality of research results
   * @param {string} researchText - Research text to assess
   * @returns {string} Quality assessment
   */
  assessResearchQuality(researchText) {
    const wordCount = researchText.split(/\s+/).length;
    
    if (wordCount < 50) return 'low';
    if (wordCount < 200) return 'medium';
    return 'high';
  }
}

module.exports = AIResearchService; 