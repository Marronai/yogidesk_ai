const express = require('express');
const { getLatestAppRelease } = require('../controllers/appReleaseController');

const router = express.Router();

router.get('/latest-release', getLatestAppRelease);

module.exports = router;
