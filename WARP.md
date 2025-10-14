# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Oga Landlord is a Progressive Web Application (PWA) for connecting property buyers/renters directly with property owners, bypassing traditional real estate agents. It's built as a client-side web application with Firebase backend services.

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **UI Framework**: Bootstrap 5.3 with Bootstrap Icons
- **Backend**: Firebase (Authentication, Firestore Database)
- **Media Storage**: Cloudinary for image/video uploads
- **PWA**: Service Worker with caching, Web App Manifest
- **Search**: Fuse.js for fuzzy search functionality
- **Real-time**: Firestore real-time listeners for chats and properties

## Development Commands

### Local Development
```bash
# Serve the application locally (use any static server)
python -m http.server 8000
# OR
npx serve .
# OR
php -S localhost:8000
```

### Testing
```bash
# Test Firebase connection and authentication
# Open browser console on index.html to check for Firebase initialization errors

# Test PWA functionality
# Use Chrome DevTools > Application > Service Workers to verify caching
# Use Chrome DevTools > Application > Manifest to verify PWA setup
```

### Deployment
```bash
# Deploy to Firebase Hosting (if configured)
firebase deploy

# Deploy to any static hosting service by uploading the entire directory
```

## Architecture Overview

### Core Application Structure
- **Entry Point**: `index.html` - Main landing page with property search and carousel
- **Authentication**: Firebase Auth integration across all pages
- **Real-time Data**: Firestore with real-time listeners for properties, chats, announcements
- **Modular Scripts**: Each page has its own JavaScript module importing shared Firebase utilities

### Key Modules

#### Firebase Integration (`scripts/firebase.js`)
- Central Firebase configuration and service exports
- Handles authentication, Firestore operations, and real-time listeners
- **Security Note**: Firebase config contains public API keys (normal for client-side apps)

#### Media Management (`scripts/cloudinary.js`)
- Handles image/video uploads to Cloudinary
- Client-side image compression before upload
- Supports both images and videos with file size validation

#### User Roles and Permissions
- **Regular Users**: Browse properties, chat with owners
- **Property Owners** (`isOwner: true`): Create/edit property listings
- **Announcers** (`isAnnouncer: true`): Create announcements
- Role-based UI visibility and access control

#### Search and Filtering (`scripts/index.js`, `scripts/land.js`, `scripts/house.js`)
- Fuse.js implementation for fuzzy search across properties
- **New Category System**: Two main categories - Land and House
  - **Land**: Subcategories for sale or for lease
  - **House**: Subcategories for sale or for rent
- Real-time filtering by verification status and subcategories
- Location-based and tag-based search capabilities

#### Property Management (`scripts/creator.js`)
- **Dynamic Form Fields**: Form changes based on Land vs House selection
- **Land Properties**: Fields for land area, land use, utilities
- **House Properties**: Fields for bedrooms, bathrooms, area, parking, furnished status
- Form validation and property CRUD operations
- Media upload workflow with progress tracking
- Edit mode with localStorage backup for draft recovery

#### Real-time Chat System (`scripts/chats.js`) - COMPLETELY REWRITTEN
- **Proper Chat Rooms**: Individual chat threads for each property inquiry
- **Real-time Messaging**: Instant message delivery using Firestore listeners
- **Unread Counters**: Accurate unread message tracking for both users and owners
- **Chat Initiation**: Users can start chats directly from property details
- **Role-based Views**: Different views for property owners vs interested users
- **Message Persistence**: All chat history stored in Firestore subcollections
- **Auto-scroll**: Messages automatically scroll to latest
- **Suggested Messages**: Quick reply options for new conversations

#### Announcements System (`scripts/announce.js`, `scripts/announcements.js`)
- **Text-only Announcements**: No media uploads, only title and content
- Role-based creation (announcers only)
- Real-time updates for new announcements

### Data Models

#### Properties Collection
```javascript
{
  title, description, price, location, 
  category: 'land' | 'house', // Main categories
  subcategory: 'for sale' | 'for rent' | 'for lease', // Subcategories
  
  // House-specific fields (when category = 'house')
  type, bedrooms, bathrooms, area, parking, furnished,
  
  // Land-specific fields (when category = 'land')
  landArea, landUse, utilities,
  
  tags: [], images: [], // Media URLs
  ownerId, ownerName, ownerEmail, ownerPhone,
  isVerified, createdAt, updatedAt
}
```

#### Users Collection
```javascript
{
  uid, email, displayName, phone,
  isOwner: boolean, isAnnouncer: boolean,
  createdAt
}
```

#### Chats Collection
```javascript
{
  propertyId, ownerId, userId,
  lastMessage, lastMessageTime,
  unreadByOwner, unreadByUser,
  createdAt
}
```

#### Messages Subcollection (chats/{chatId}/messages)
```javascript
{
  content, senderId, senderName,
  timestamp
}
```

### File Organization
```
├── index.html              # Main landing page with property search
├── creator.html           # Property creation/editing form (dynamic fields)
├── chats.html            # Real-time messaging interface
├── profile.html          # User profile management
├── land.html             # Land properties (for sale/lease)
├── house.html            # House properties (for sale/rent)
├── announcements.html    # View announcements (text-only)
├── announce.html         # Create announcements (text-only)
├── css/
│   └── style.css         # Main stylesheet with CSS custom properties
├── scripts/
│   ├── firebase.js       # Firebase configuration and utilities
│   ├── cloudinary.js     # Media upload handling
│   ├── index.js          # Homepage with updated category filters
│   ├── creator.js        # Dynamic property form (land/house)
│   ├── chats.js          # Complete rewrite - real-time chat system
│   ├── land.js           # Land property listings and filtering
│   ├── house.js          # House property listings and filtering
│   ├── announce.js       # Text-only announcement creation
│   ├── announcements.js  # Text-only announcement viewing
│   ├── theme.js          # Dark/light theme switching
│   └── service-worker.js # PWA caching strategy
└── media/               # Static assets and user uploads
```

### Key Features to Understand

#### New Category System (Major Change)
- **Simplified Structure**: Only two main categories (Land/House) instead of three
- **Dynamic Forms**: Property creation form adapts based on category selection
- **Subcategory Filtering**: Each main category has relevant subcategories
- **Updated Navigation**: All pages now reflect Land/House structure

#### Completely Rewritten Chat System
- **Proper Chat Flow**: User clicks "Chat Owner" → redirected to chats.html → chat room opens
- **Real-time Everything**: Messages, unread counts, chat lists all update instantly
- **Subcollection Architecture**: Messages stored in Firestore subcollections for better scalability
- **User Experience**: Suggested messages for new chats, proper message bubbles, timestamps
- **Reliable State Management**: Handles authentication, chat creation, and message delivery robustly

#### Text-only Announcements
- **Simplified**: Removed media upload complexity
- **Content Focus**: Just title, text content, and optional links
- **Performance**: Faster loading without media processing

#### Theme System
- CSS custom properties for consistent theming
- LocalStorage persistence for user theme preference
- Toggle between light/dark modes across all pages

#### PWA Implementation
- Service Worker caches static assets for offline functionality
- Web App Manifest enables "Add to Home Screen"
- Responsive design works across all device sizes

#### Real-time Updates
- Properties, chats, and announcements use Firestore real-time listeners
- UI updates automatically when data changes server-side
- Unread message badges update in real-time across tabs

#### Form Validation and UX
- **Dynamic Validation**: Form fields and validation adapt to Land vs House properties
- Client-side validation with user-friendly error messages
- Image compression before upload to optimize performance
- Draft saving in localStorage prevents data loss

### Security Considerations
- Firebase Security Rules enforce server-side access control
- Client-side role checking is for UI only - never rely on it for security
- All user actions are validated against Firebase Security Rules
- Sensitive operations require authenticated user context