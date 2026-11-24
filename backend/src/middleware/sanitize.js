// strips keys starting with $ or containing . to block NoSQL operator injection
const clean = (obj) => {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    if (k.startsWith('$') || k.includes('.')) delete obj[k];
    else clean(obj[k]);
  }
};

export default (req, res, next) => {
  clean(req.body);
  clean(req.query);
  clean(req.params);
  next();
};