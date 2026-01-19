const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const archiver = require('archiver');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Multer configuration for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = `uploads/${Date.now()}`;
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// Common permissions
const androidPermissions = [
    { id: 'INTERNET', name: 'Internet Access', description: 'Akses internet' },
    { id: 'VIBRATE', name: 'Vibration', description: 'Akses getar' },
    { id: 'CAMERA', name: 'Camera', description: 'Akses kamera' },
    { id: 'RECORD_AUDIO', name: 'Microphone', description: 'Akses mikrofon' },
    { id: 'ACCESS_FINE_LOCATION', name: 'GPS Location', description: 'Akses lokasi GPS' },
    { id: 'READ_EXTERNAL_STORAGE', name: 'Read Storage', description: 'Baca penyimpanan' },
    { id: 'WRITE_EXTERNAL_STORAGE', name: 'Write Storage', description: 'Tulis penyimpanan' },
    { id: 'ACCESS_NETWORK_STATE', name: 'Network State', description: 'Status jaringan' },
    { id: 'WAKE_LOCK', name: 'Wake Lock', description: 'Layar tetap menyala' }
];

// API Routes
app.get('/api/permissions', (req, res) => {
    res.json(androidPermissions);
});

app.post('/api/generate', upload.array('assets'), async (req, res) => {
    try {
        const { 
            appTitle, 
            packageName, 
            sourceType, 
            websiteUrl, 
            permissions,
            versionCode,
            versionName
        } = req.body;

        // Create unique build ID
        const buildId = `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const buildDir = path.join(__dirname, 'builds', buildId);
        
        await fs.mkdir(buildDir, { recursive: true });

        // Clone APKGeneratorBase repository
        console.log('Cloning APKGeneratorBase...');
        await execPromise(`git clone https://github.com/stringmanolo/APKGeneratorBase "${buildDir}/APKGeneratorBase"`);
        
        const baseDir = path.join(buildDir, 'APKGeneratorBase');
        
        // Update AndroidManifest.xml
        let androidManifest = await fs.readFile(
            path.join(baseDir, 'src/main/AndroidManifest.xml'), 
            'utf8'
        );
        
        // Replace package name
        androidManifest = androidManifest.replace(
            /com\.mimarca\.MiPrimeraApp/g, 
            packageName
        );
        
        // Add permissions
        const permissionList = JSON.parse(permissions || '[]');
        let permissionsXml = '';
        permissionList.forEach(perm => {
            permissionsXml += `    <uses-permission android:name="android.permission.${perm}" />\n`;
        });
        
        // Find where to insert permissions
        const manifestIndex = androidManifest.indexOf('<application');
        if (manifestIndex !== -1) {
            androidManifest = androidManifest.slice(0, manifestIndex) + 
                             permissionsXml + 
                             androidManifest.slice(manifestIndex);
        }
        
        await fs.writeFile(
            path.join(baseDir, 'src/main/AndroidManifest.xml'), 
            androidManifest
        );

        // Update ActividadPrincipal.java
        let actividadPrincipal = await fs.readFile(
            path.join(baseDir, 'src/main/java/ActividadPrincipal.java'), 
            'utf8'
        );
        
        // Replace package
        actividadPrincipal = actividadPrincipal.replace(
            /package com\.mimarca\.MiPrimeraApp/g, 
            `package ${packageName}`
        );
        
        // Replace URL or assets path
        if (sourceType === 'url') {
            actividadPrincipal = actividadPrincipal.replace(
                /file\:\/\/\/android_asset\/index\.html/g, 
                websiteUrl
            );
        }
        
        await fs.writeFile(
            path.join(baseDir, 'src/main/java/ActividadPrincipal.java'), 
            actividadPrincipal
        );

        // Update package directory structure
        const packagePath = packageName.replace(/\./g, '/');
        const javaDir = path.join(baseDir, 'src/main/java', packagePath);
        
        await fs.mkdir(javaDir, { recursive: true });
        
        // Move and rename Java files
        await fs.rename(
            path.join(baseDir, 'src/main/java/ActividadPrincipal.java'),
            path.join(javaDir, 'ActividadPrincipal.java')
        );
        
        await fs.rename(
            path.join(baseDir, 'src/main/java/JSInterface.java'),
            path.join(javaDir, 'JSInterface.java')
        );

        // Update strings.xml for app title
        let stringsXml = await fs.readFile(
            path.join(baseDir, 'src/main/res/values/strings.xml'), 
            'utf8'
        );
        
        stringsXml = stringsXml.replace(
            /<string name="app_name">.*?<\/string>/g,
            `<string name="app_name">${appTitle}</string>`
        );
        
        await fs.writeFile(
            path.join(baseDir, 'src/main/res/values/strings.xml'), 
            stringsXml
        );

        // Handle assets if uploaded
        if (sourceType === 'assets' && req.files) {
            const assetsDir = path.join(baseDir, 'src/main/assets');
            
            // Clear existing assets
            await fs.rm(assetsDir, { recursive: true, force: true });
            await fs.mkdir(assetsDir, { recursive: true });
            
            // Copy uploaded files
            for (const file of req.files) {
                const destPath = path.join(assetsDir, file.originalname);
                await fs.copyFile(file.path, destPath);
            }
        }

        // Build APK
        console.log('Building APK...');
        await execPromise(`cd "${baseDir}" && chmod +x gradlew && ./gradlew assembleDebug`, {
            cwd: baseDir,
            timeout: 300000 // 5 minutes timeout
        });

        // Find the APK file
        const apkPath = path.join(baseDir, 'app/build/outputs/apk/debug/app-debug.apk');
        
        if (!await fileExists(apkPath)) {
            throw new Error('APK build failed');
        }

        // Rename APK
        const finalApkName = `${appTitle.replace(/\s+/g, '_')}_${versionName}.apk`;
        const finalApkPath = path.join(buildDir, finalApkName);
        
        await fs.copyFile(apkPath, finalApkPath);

        // Cleanup
        await fs.rm(baseDir, { recursive: true, force: true });
        
        // Return download URL
        res.json({
            success: true,
            downloadUrl: `/download/${buildId}/${finalApkName}`,
            message: 'APK berhasil digenerate!'
        });

    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/download/:buildId/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'builds', req.params.buildId, req.params.filename);
    
    res.download(filePath, req.params.filename, async (err) => {
        if (!err) {
            // Cleanup after download
            try {
                await fs.rm(path.dirname(filePath), { recursive: true, force: true });
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError);
            }
        }
    });
});

// Utility functions
function execPromise(command, options = {}) {
    return new Promise((resolve, reject) => {
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}

async function fileExists(path) {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

// Start server
app.listen(port, () => {
    console.log(`APK Generator API berjalan di http://localhost:${port}`);
});
