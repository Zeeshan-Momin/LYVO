# TECHNICAL SYSTEMS GUIDE — LYVO Architecture

This document exposes the system specifications, data models, interaction sequence flows, and REST API definitions for LYVO.

---

## 🏗️ 1. Database Model Relations (ER Schema)

```mermaid
erDiagram
    User {
        ObjectId id PK
        string name
        string email
        string password
        string role
        array passwordHistory
        int loginAttempts
        date lockUntil
    }
    Session {
        ObjectId id PK
        ObjectId userId FK
        string tokenFamily
        string tokenHash
        string userAgent
        string ipAddress
        boolean isValid
    }
    Product {
        ObjectId id PK
        string name
        string brand
        string categoryId FK
        int totalStock
        double price
    }
    Order {
        ObjectId id PK
        ObjectId userId FK
        array items
        double totalAmount
        string status
        string trackingNumber
    }
    Review {
        ObjectId id PK
        ObjectId productId FK
        ObjectId userId FK
        int rating
        string title
        string comment
    }
    
    User ||--o{ Session : "owns"
    User ||--o{ Order : "places"
    User ||--o{ Review : "writes"
    Product ||--o{ Review : "receives"
    Order }|--|{ Product : "contains"
```

---

## 🔒 2. Authentication Sequence Flow (RTR & Lockout Validation)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client App
    participant Gateway as Express App
    participant Controller as Auth Controller
    participant DB as MongoDB / Redis

    Client->>Gateway: POST /api/auth/login (email, password)
    Gateway->>Controller: Verify input parameters
    Controller->>DB: Check if user is locked (lockUntil > Date.now)
    alt Account is Locked
        DB-->>Controller: True
        Controller-->>Client: 423 Locked (Remaining Lock Timer)
    else Account is Active
        DB-->>Controller: False
        Controller->>DB: Verify password hash
        alt Password Mismatch
            Controller->>DB: Increment loginAttempts
            Controller-->>Client: 401 Unauthorized (Invalid credentials)
        else Password Valid
            Controller->>DB: Reset loginAttempts
            Controller->>DB: Create Session (family, hashed token)
            Controller-->>Client: 200 OK (JWT, Refresh Token)
        end
    end
```

---

## 🛒 3. Checkout & Transaction processing Flow

```mermaid
sequenceDiagram
    autonumber
    actor Client as Customer
    participant Gateway as Express App
    participant Controller as Order Controller
    participant DB as MongoDB / Redis
    participant GatewayRP as Razorpay API

    Client->>Gateway: POST /api/orders (Address, Items, Coupon, PaymentMethod)
    Gateway->>Controller: Authenticate & Validate Payload
    Controller->>DB: Verify Coupon Validity & Product Inventory Stocks
    DB-->>Controller: Stocks OK
    alt Cash On Delivery
        Controller->>DB: Decrement stocks & Save Order
        Controller-->>Client: 201 Created (Order detail)
    else Online Razorpay Transaction
        Controller->>GatewayRP: Create razorpay order instance
        GatewayRP-->>Controller: Razorpay Order ID
        Controller-->>Client: Send Transaction Details
        Client->>GatewayRP: Complete Payment Modal
        GatewayRP-->>Client: Payment Signature
        Client->>Gateway: POST /api/payment/verify (Signature)
        Gateway->>Controller: Verify SHA256 Signature
        Controller->>DB: Save order as Paid & Decrement stocks
        Controller-->>Client: 200 OK (Payment Verified)
    end
```

---

## 🔌 4. REST API Specification (OpenAPI/Swagger Summary)

### Authentication Resource
- `POST /api/auth/register`: Create user account.
- `POST /api/auth/login`: Login user. Handles lockout and password checks.
- `POST /api/auth/refresh`: Dynamic Refresh Token Rotation (RTR). Revokes all sessions on token reuse anomaly.
- `POST /api/auth/logout`: Revoke current active session.
- `POST /api/auth/logout-all`: Revoke all user sessions.

### Product Resource
- `GET /api/products`: Filter and paginate catalog items.
- `GET /api/products/:id`: Fetch detailed specifications.
- `POST /api/products` (Admin): Create catalog product.

### Order Resource
- `POST /api/orders`: Place customer order.
- `GET /api/orders/my`: Fetch customer history lists.
- `GET /api/orders/track/:orderNumber`: Live tracking details.
