import admin from 'firebase-admin';

// Check if already initialized
if (!admin.apps.length) {
  try {
    // You should place your service account file in the root or use env variables
    // For Render, it's better to use an environment variable with the JSON string
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : require('../../firebase-service-account.json');

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
