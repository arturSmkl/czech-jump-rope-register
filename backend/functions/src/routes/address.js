const RUIAN_BASE_URL = 'https://ruian.fnx.io/api/v1/ruian/validate';

const validateAddress = async (req, res) => {
  const apiKey = process.env.RUIAN_API_KEY;
  if (!apiKey) {
    return res.status(500).send({ error: 'RUIAN API key not configured on server' });
  }

  const { street, house_number, zip_code, township } = req.query;

  const params = new URLSearchParams();
  params.append('apiKey', apiKey);
  if (township) params.append('municipalityName', township);
  if (zip_code) params.append('zip', zip_code);
  if (house_number) params.append('cp', house_number);
  if (street) params.append('street', street);

  try {
    const response = await fetch(`${RUIAN_BASE_URL}?${params.toString()}`);

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).send({ error: 'RUIAN rate limit exceeded' });
      }
      return res.status(response.status).send({ error: `RUIAN API error: ${response.status}` });
    }

    const data = await response.json();
    const valid = data && (data.status === 'MATCH' || data.status === 'POSSIBLE');
    return res.status(200).send({ valid });
  } catch (err) {
    console.error('VALIDATE_ADDRESS_ERROR:', err);
    return res.status(500).send({ error: err.message });
  }
};

module.exports = { validateAddress };
