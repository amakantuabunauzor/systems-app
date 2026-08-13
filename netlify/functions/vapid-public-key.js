exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicKey: process.env.VAPID_PUBLIC_KEY || '' })
  };
};
