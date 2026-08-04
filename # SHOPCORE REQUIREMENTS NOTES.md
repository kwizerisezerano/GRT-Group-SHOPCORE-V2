# SHOPCORE REQUIREMENTS NOTES

## PROJECT STRUCTURE

---

* Organize the project code into two main folders:

  * Backend
  * Frontend

The backend and frontend should be separated clearly to ensure good project management, scalability, and maintainability.

---

# BACKEND REQUIREMENTS

---

1. **Sensitive Data Security**

* All sensitive data such as:

  * Names
  * Emails
  * Phone numbers
  * Other personal information

must be encrypted using **AES-256-GCM encryption**.

* Email and phone numbers must also be hashed using **HMAC-SHA256** to:

  * Prevent duplication
  * Allow secure searching
  * Protect user privacy

---

2. **Database**

* Database system: **MySQL**

Requirements:

* Proper database relationships
* Foreign key enforcement
* Avoid orphan records
* Ensure zero duplication using unique constraints

---

3. **Email Notification**

* The system must support email notifications for different activities such as:

  * Account notifications
  * System alerts
  * User actions
  * Transaction updates

---

4. **Fields Validation**

* All input fields must have proper validation.
* Validation must be implemented to prevent:

  * Invalid data
  * Empty required fields
  * Wrong formats
  * Incorrect user input

---

5. **Backend Technology**

* Backend framework/language:

  * Node.js

---

6. **Multi-language Support**

The system must support full translations for:

* English (en)
* Swahili (sw)
* Spanish (es)
* French (fr)

---

7. **File and Image Storage**

* All files and images must be stored using:

  * Cloudinary

The database should store only the required file information such as URLs and references.

---

8. **API Response Standards**

All APIs must return proper status codes and messages.

Examples:

* 200 → Successful request
* 201 → Successfully created
* 400 → Bad request / validation error
* 409 → Duplicate record
* 500 → Internal server error

Every response must include a clear message explaining what happened in the system.

---

9. **Swagger Documentation**

* All API routes must be documented using Swagger.
* Swagger should include:

  * Routes
  * Request parameters
  * Response examples
  * Authentication details

---

10. **API Testing**

* Application APIs must be tested using AppIDong.
* Testing must cover:

  * API functionality
  * Validation
  * Error handling
  * Security rules

---

# FRONTEND REQUIREMENTS

---

1. **Frontend Framework**

* Frontend must use:

  * Nuxt Framework

---

2. **Design and UI**

Requirements:

* Use Montserrat font
* Use Vuetify library
* Create a professional and responsive interface

---

3. **Direct Field Validation**

* Every form field must have frontend validation before submitting data.

Examples:

* Required fields
* Correct formats
* Input length validation

---

4. **Backend Message Display**

* The frontend must use backend API messages to inform users about system actions.

Examples:

* "Product successfully created"
* "Email already exists"
* "Invalid password"
* "Payment completed successfully"

Users must always understand what is happening in the system.

---

5. **Backend as the Main Data Source**

* Every data displayed in the frontend must come from the backend.

The frontend must not contain hardcoded business data.

Data flow:

Frontend → API → Backend → Database

---

# GENERAL SYSTEM OBJECTIVES

---

The SHOPCORE system must be:

* Secure
* Scalable
* Reliable
* Multilingual
* Easy to maintain
* Protected against duplicate data
* Designed with proper database relationships
* User-friendly with clear system messages
