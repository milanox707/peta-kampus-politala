require('dotenv').config();
const fetch = require('node-fetch');
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');


const app = express();

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======== LIST BUILDING SCRIPTS ========
app.get('/api/building-scripts', (req, res) => {
    const buildingsDir = path.join(__dirname, 'public', 'buildings');

    fs.mkdir(buildingsDir, { recursive: true }, (mkdirErr) => {
        if (mkdirErr) {
            console.error("❌ Failed to create/read buildings folder:", mkdirErr);
            return res.status(500).json({ error: 'Cannot access buildings folder' });
        }

        fs.readdir(buildingsDir, (err, files) => {
            if (err) {
                console.error("❌ Failed to read buildings folder:", err);
                return res.status(500).json({ error: 'Failed to read buildings folder' });
            }

            const jsFiles = files
                .filter(file => file.endsWith('.js'))
                .map(file => `/buildings/${file}`);
            res.json(jsFiles);
        });
    });
});

const bcrypt = require('bcrypt');

const ADMIN_PASSWORD_HASH = "$2b$10$PD.SbFs99RXmLncuidmvL.TqA5GPVojvJ2uadJYYepG0Y8EFcgbrq";

app.post('/api/admin-login', express.json(), async (req, res) => {
    const { password } = req.body;
    const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (match) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: 'Incorrect password' });
    }
});



// ======== SAVE NEW BUILDING ========
app.post('/api/save-building', (req, res) => {
    let { name, image, x, y, floors } = req.body;

    // Defensive checks
    if (!name || !image || typeof x === 'undefined' || typeof y === 'undefined') {
        console.error("❌ Missing required building fields:", req.body);
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!Array.isArray(floors)) floors = [];

    const safeName = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const filename = `${safeName}.js`;
    const filePath = path.join(__dirname, 'public', 'buildings', filename);

    const jsContent = `
registerBuilding({
    name: "${name}",
    image: "${image}",
    x: ${x},
    y: ${y},
    floors: ${JSON.stringify(floors, null, 4)}
});
`;

    console.log("💾 Saving building to:", filePath);

    fs.mkdir(path.join(__dirname, 'public', 'buildings'), { recursive: true }, (mkdirErr) => {
        if (mkdirErr) {
            console.error("❌ Failed to create buildings folder:", mkdirErr);
            return res.status(500).json({ error: 'Could not create buildings folder' });
        }

        fs.writeFile(filePath, jsContent, (err) => {
            if (err) {
                console.error("❌ Failed to write building file:", err);
                return res.status(500).json({ error: 'Failed to save building' });
            }

            console.log(`✅ Saved new building: ${filename}`);
            res.json({ success: true, filename });
        });
    });
});

// ======== IMAGE UPLOAD HANDLER ========
const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const imgDir = path.join(__dirname, 'public', 'images');
        fs.mkdirSync(imgDir, { recursive: true });
        cb(null, imgDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});
const uploadImage = multer({ storage: imageStorage });

app.post('/api/upload-image', uploadImage.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const imagePath = `/images/${req.file.filename}`;
    console.log("🖼️ Uploaded image:", imagePath);
    res.json({ imagePath });
});

app.post('/api/delete-building', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'No name provided' });

    const safeName = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const filePath = path.join(__dirname, 'public', 'buildings', `${safeName}.js`);

    fs.unlink(filePath, err => {
        if (err) {
            console.error("Failed to delete:", filePath, err);
            return res.status(500).json({ error: 'Could not delete building file' });
        }

        console.log("✅ Deleted building:", filePath);
        res.json({ success: true });
    });
});

let cachedWeather = null;
let lastFetched = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const WEATHER_API_KEY = 'ff7dc8c10056b71c93e3748c51481152';
//const LAT = -3.8079;
//const LON = 114.7921;//Lokasi

app.get('/api/weather', async (req, res) => {
    const now = Date.now();


            if (!cachedWeather || now - lastFetched > CACHE_DURATION) {
        try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=-3.8011&lon=114.8083&appid=${WEATHER_API_KEY}&units=metric&lang=id`;
        const response = await fetch(url);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Fetch failed: ${response.status} ${response.statusText} — ${errorText}`);
        }

        const data = await response.json();
        cachedWeather = data;
        lastFetched = now;
        console.log("✅ Weather updated.");
        } catch (err) {
        console.error("❌ Weather fetch failed:", err.message);
        return res.status(500).json({ error: "Failed to fetch weather", detail: err.message });
        }


    } else {
        console.log("📦 Using cached weather.");
    }

    res.json(cachedWeather);
});
// ======== START SERVER ========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

