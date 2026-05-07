# AIBMS - Comprehensive Features Documentation

This document provides an exhaustive, user-centric breakdown of all features and capabilities within the AIBMS platform.

## 1. Multi-Branch Dashboard & Analytics
The central hub for business intelligence, providing a unified view of your organization's financial health.
- **Consolidated Financial View**: Real-time aggregation of revenue, expenses, and net profit across all business branches.
- **Branch-Level Isolation**: Filter analytics to view performance for a specific branch (e.g., Head Office vs. Warehouse).
- **Trend Analysis**: Visual charts and graphs representing daily, weekly, and monthly financial trends.

## 2. Intelligent Digital Cashbook
A modern, digital replacement for traditional ledgers, tightly integrated with multi-branch management.
- **Credit & Debit Tracking**: Log "Money In" (Receivables/Income) and "Money Out" (Payables/Expenses).
- **Custom Categorization**: Assign and manage custom transaction categories with distinct colors and icons.
- **Lifecycle Tracking**: Differentiate between the expected `date` of a transaction and the actual `settlement_date` (when the money actually moved).
- **Payment Modes**: Native support for tracking Cash, UPI, Bank Transfer, Cheque, and Card transactions.
- **Daily Summaries**: Automatic daily snapshots tracking total credit, total debit, opening balances, and closing balances.


## 3. Conversational AI Chatbot (CA Assistant)
An advanced AI assistant designed to handle financial operations via natural language.
- **Voice & Text Interfaces**: Speak directly to the assistant using AssemblyAI for voice-to-text, and receive natural voice responses via Murf AI.
- **Natural Language Execution**: Tell the AI to "Log ₹500 payable for office rent." The AI parses this, prepares the Cashbook entry, and waits for your confirmation to execute.
- **Business Insights & Querying**: Ask questions about your business data (e.g., "What were my total expenses last month?") or query accounting standards from the built-in Knowledge Base.
- **Response Bookmarking**: Save and bookmark helpful AI responses for future reference.
- **Usage Tracking**: Monitor chatbot usage, token consumption, and query types.

## 4. Document Intelligence & Cloud Storage
A secure, AI-powered document repository for managing invoices, receipts, and contracts.
- **Hierarchical Folders**: Organize documents into custom folders and subfolders.
- **AI Invoice Parsing**: Upload an invoice or receipt, and the AI automatically extracts the Vendor Name, Amount, Date, and Category.
- **Cashbook Integration (Push to Cashbook)**: After the AI parses a document, an intermediate modal allows you to verify the extracted data before instantly converting it into a Cashbook transaction.
- **Expiry Tracking**: Set expiry dates on licences, agreements, or contracts. The system will track and flag expired documents.
- **Secure Internal Sharing**: Share documents with team members, granting strictly "View" or "Download" access. You can also set a specific expiration date and time for the shared link.
- **Audit Trails**: Detailed logging of every interaction—know exactly who viewed, downloaded, or shared a document and when.

## 5. Business & Branch Configuration
Built to scale with complex, real-world business structures.
- **Multi-Business Support**: Manage entirely distinct businesses under a single account.
- **Branch Disambiguation**: Use the `locality` feature to distinguish between multiple branches located within the same city.
- **Operating Hours**: Configure granular opening and closing times for each branch, per day of the week.
- **Compliance Tracking**: Store and manage GSTIN, PAN, TAN, and business registration numbers centrally.
- **Customization**: Configure business-wide settings such as base currency (`₹`, `$`) and toggle core modules (Cashbook, Documents, Chatbot) on or off as needed.
