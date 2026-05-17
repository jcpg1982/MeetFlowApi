import admin from 'firebase-admin';

// Check if already initialized
if (!admin.apps.length) {
  try {
    // You should place your service account file in the root or use env variables
    // For Render, it's better to use an environment variable with the JSON string
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      const fs = require('fs');
      const path = require('path');
      
      const debugPath = path.resolve(__dirname, '../../firebase-service-account-debug.json');
      const releasePath = path.resolve(__dirname, '../../firebase-service-account-release.json');
      const defaultPath = path.resolve(__dirname, '../../firebase-service-account.json');
      
      const isProduction = process.env.NODE_ENV === 'production';
      
      if (isProduction && fs.existsSync(releasePath)) {
        serviceAccount = require(releasePath);
      } else if (!isProduction && fs.existsSync(debugPath)) {
        serviceAccount = require(debugPath);
      } else {
        serviceAccount = require(defaultPath);
      }
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized');
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

export const sendNotification = async (token: string, title: string, body: string, data?: any) => {
  if (!token) return;
  
  const message = {
    notification: { title, body },
    data: data || {},
    token: token
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
  } catch (error) {
    console.error('Error sending message:', error);
  }
};
