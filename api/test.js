module.exports = async (req, res) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const authorizedUserId = process.env.AUTHORIZED_USER_ID;
    const mongoUri = process.env.MONGODB_URI;

    const envCheck = {
      hasToken: !!token,
      hasUserId: !!authorizedUserId,
      hasMongoUri: !!mongoUri,
      tokenLength: token ? token.length : 0,
      userId: authorizedUserId,
      mongoUriPreview: mongoUri ? mongoUri.substring(0, 20) + '...' : 'not set'
    };

    res.status(200).json({
      message: 'Environment check',
      env: envCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Test failed',
      message: error.message
    });
  }
}; 