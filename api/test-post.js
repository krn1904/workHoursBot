module.exports = async (req, res) => {
  console.log('=== TEST POST ENDPOINT CALLED ===');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  if (req.method === 'POST') {
    res.status(200).json({ 
      message: 'POST request received successfully',
      timestamp: new Date().toISOString(),
      body: req.body
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 