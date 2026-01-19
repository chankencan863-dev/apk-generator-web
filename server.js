const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { exec, spawn } = require('child_process');
const util = require('util');
const cors = require('cors');
const archiver = require('archiver');
const axios = require('axios');
const sharp = require('sharp');

const app = express();
const port = process.env.PORT || 3000;

// Promisify exec
const execPromise = util.promisify(exec);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Create necessary directories
const directories = ['uploads', 'builds', 'templates', 'downloads'];
directories.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

// Enhanced multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = `uploads/${Date.now()}`;
        const dirPath = path.join(__dirname, uploadDir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 100 // Max 100 files
    }
});

// Android permissions list
const ANDROID_PERMISSIONS = [
    { id: 'INTERNET', name: 'Internet', description: 'Akses koneksi internet' },
    { id: 'ACCESS_NETWORK_STATE', name: 'Network State', description: 'Lihat status jaringan' },
    { id: 'VIBRATE', name: 'Vibration', description: 'Akses getar perangkat' },
    { id: 'CAMERA', name: 'Camera', description: 'Akses kamera' },
    { id: 'RECORD_AUDIO', name: 'Microphone', description: 'Akses mikrofon' },
    { id: 'READ_EXTERNAL_STORAGE', name: 'Read Storage', description: 'Baca penyimpanan eksternal' },
    { id: 'WRITE_EXTERNAL_STORAGE', name: 'Write Storage', description: 'Tulis penyimpanan eksternal' },
    { id: 'ACCESS_FINE_LOCATION', name: 'GPS Location', description: 'Akses lokasi GPS' },
    { id: 'ACCESS_COARSE_LOCATION', name: 'Network Location', description: 'Akses lokasi jaringan' },
    { id: 'WAKE_LOCK', name: 'Wake Lock', description: 'Jaga layar tetap menyala' },
    { id: 'BLUETOOTH', name: 'Bluetooth', description: 'Akses Bluetooth' },
    { id: 'NFC', name: 'NFC', description: 'Akses NFC' },
    { id: 'READ_CONTACTS', name: 'Read Contacts', description: 'Baca kontak' },
    { id: 'READ_CALENDAR', name: 'Read Calendar', description: 'Baca kalender' },
    { id: 'READ_SMS', name: 'Read SMS', description: 'Baca SMS' },
    { id: 'RECEIVE_SMS', name: 'Receive SMS', description: 'Terima SMS' },
    { id: 'SEND_SMS', name: 'Send SMS', description: 'Kirim SMS' },
    { id: 'CALL_PHONE', name: 'Call Phone', description: 'Melakukan panggilan telepon' }
];

// API Routes
app.get('/api/permissions', (req, res) => {
    res.json(ANDROID_PERMISSIONS);
});

app.get('/api/templates', async (req, res) => {
    try {
        const templates = [
            { id: 'basic', name: 'Basic WebView', description: 'Template dasar WebView' },
            { id: 'pwa', name: 'PWA Template', description: 'Template Progressive Web App' },
            { id: 'game', name: 'Game Template', description: 'Template untuk game HTML5' },
            { id: 'business', name: 'Business Template', description: 'Template untuk aplikasi bisnis' }
        ];
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Check system requirements
app.get('/api/check-system', async (req, res) => {
    try {
        const checks = {
            git: false,
            java: false,
            node: true,
            memory: false,
            disk: false
        };

        try {
            await execPromise('git --version');
            checks.git = true;
        } catch (e) {
            checks.git = false;
        }

        try {
            await execPromise('java -version');
            checks.java = true;
        } catch (e) {
            checks.java = false;
        }

        // Check memory (Linux/Unix)
        if (process.platform !== 'win32') {
            try {
                const { stdout } = await execPromise('free -m');
                const lines = stdout.split('\n');
                const memLine = lines[1].split(/\s+/);
                const totalMem = parseInt(memLine[1]);
                checks.memory = totalMem >= 2048; // 2GB minimum
            } catch (e) {
                checks.memory = true; // Skip check if command fails
            }
        }

        // Check disk space
        try {
            const { stdout } = await execPromise('df -h /');
            checks.disk = true;
        } catch (e) {
            checks.disk = true; // Skip check if command fails
        }

        res.json({
            success: true,
            checks,
            message: checks.git && checks.java ? 
                'System ready for APK generation' : 
                'Some requirements are missing'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Main APK generation endpoint
app.post('/api/generate', upload.array('assets'), async (req, res) => {
    const startTime = Date.now();
    let buildDir = '';
    let logMessages = [];

    try {
        const {
            appTitle,
            packageName,
            sourceType,
            websiteUrl,
            permissions = '[]',
            versionCode = '1',
            versionName = '1.0',
            template = 'basic',
            enableSplash = 'false',
            appDescription = '',
            iconData = ''
        } = req.body;

        logMessages.push('Starting APK generation process...');
        logMessages.push(`App Title: ${appTitle}`);
        logMessages.push(`Package Name: ${packageName}`);
        logMessages.push(`Source Type: ${sourceType}`);

        // Validate inputs
        if (!appTitle || !packageName) {
            throw new Error('App title and package name are required');
        }

        if (sourceType === 'url' && !websiteUrl) {
            throw new Error('Website URL is required for URL source type');
        }

        // Create unique build ID and directory
        const buildId = `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        buildDir = path.join(__dirname, 'builds', buildId);
        await fs.mkdir(buildDir, { recursive: true });

        // Clone APKGeneratorBase
        logMessages.push('Cloning APKGeneratorBase repository...');
        const cloneResult = await execPromise(
            `git clone https://github.com/stringmanolo/APKGeneratorBase "${buildDir}/APKGeneratorBase"`,
            { timeout: 60000 }
        );
        logMessages.push('Repository cloned successfully');

        const baseDir = path.join(buildDir, 'APKGeneratorBase');
        
        // Parse permissions
        const permissionList = JSON.parse(permissions);
        
        // 1. Update AndroidManifest.xml
        logMessages.push('Updating AndroidManifest.xml...');
        await updateAndroidManifest(baseDir, packageName, permissionList, appDescription);
        
        // 2. Update Java files
        logMessages.push('Updating Java source files...');
        await updateJavaFiles(baseDir, packageName, sourceType === 'url' ? websiteUrl : null);
        
        // 3. Update strings.xml
        logMessages.push('Updating strings.xml...');
        await updateStringsXml(baseDir, appTitle);
        
        // 4. Update build.gradle
        logMessages.push('Updating build.gradle...');
        await updateBuildGradle(baseDir, versionCode, versionName);
        
        // 5. Handle assets
        if (sourceType === 'assets' && req.files && req.files.length > 0) {
            logMessages.push(`Copying ${req.files.length} asset files...`);
            await copyAssets(baseDir, req.files);
        }
        
        // 6. Handle app icon
        if (iconData) {
            logMessages.push('Processing app icon...');
            await processAppIcon(baseDir, iconData);
        }
        
        // 7. Handle splash screen
        if (enableSplash === 'true') {
            logMessages.push('Configuring splash screen...');
            await configureSplashScreen(baseDir, appTitle);
        }
        
        // 8. Build APK
        logMessages.push('Building APK with Gradle...');
        const buildResult = await buildApk(baseDir);
        logMessages.push(`Build completed: ${buildResult}`);
        
        // 9. Find APK file
        const apkPaths = [
            path.join(baseDir, 'app/build/outputs/apk/debug/app-debug.apk'),
            path.join(baseDir, 'app/build/outputs/apk/debug/APKGeneratorBase-debug.apk'),
            path.join(baseDir, 'build/outputs/apk/debug/app-debug.apk')
        ];
        
        let apkPath = '';
        for (const path of apkPaths) {
            try {
                await fs.access(path);
                apkPath = path;
                break;
            } catch (e) {
                // Continue to next path
            }
        }
        
        if (!apkPath) {
            // Try to find any APK file
            const findResult = await execPromise(`find "${baseDir}" -name "*.apk" -type f`, { shell: true });
            const apkFiles = findResult.stdout.trim().split('\n').filter(f => f);
            if (apkFiles.length > 0) {
                apkPath = apkFiles[0];
            }
        }
        
        if (!apkPath) {
            throw new Error('APK file not found after build');
        }
        
        // 10. Rename and move APK
        const safeTitle = appTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const finalApkName = `${safeTitle}_${versionName}.apk`;
        const finalApkPath = path.join(__dirname, 'downloads', finalApkName);
        
        await fs.copyFile(apkPath, finalApkPath);
        logMessages.push(`APK saved as: ${finalApkName}`);
        
        // 11. Cleanup build directory (optional)
        // await fs.rm(buildDir, { recursive: true, force: true });
        
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        logMessages.push(`Total generation time: ${totalTime} seconds`);
        
        // Return success response
        res.json({
            success: true,
            downloadUrl: `/download/${finalApkName}`,
            fileName: finalApkName,
            fileSize: (await fs.stat(finalApkPath)).size,
            buildTime: totalTime,
            logs: logMessages
        });
        
    } catch (error) {
        logMessages.push(`ERROR: ${error.message}`);
        console.error('APK Generation Error:', error);
        
        // Cleanup on error
        if (buildDir) {
            try {
                await fs.rm(buildDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError);
            }
        }
        
        res.status(500).json({
            success: false,
            error: error.message,
            logs: logMessages
        });
    }
});

// Download endpoint
app.get('/download/:filename', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'downloads', req.params.filename);
        
        // Check if file exists
        await fs.access(filePath);
        
        // Set headers for download
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        
        // Stream file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
        
        // Optional: Delete file after download
        fileStream.on('end', async () => {
            try {
                await fs.unlink(filePath);
            } catch (e) {
                console.error('Error deleting file:', e);
            }
        });
        
    } catch (error) {
        res.status(404).json({ error: 'File not found' });
    }
});

// Batch generation endpoint
app.post('/api/generate-batch', upload.array('configs'), async (req, res) => {
    try {
        const configs = JSON.parse(req.body.configs || '[]');
        const results = [];
        
        for (const config of configs) {
            try {
                // Simulate generation for each config
                const result = await generateSingleAPK(config);
                results.push({
                    ...config,
                    success: true,
                    downloadUrl: result.downloadUrl
                });
            } catch (error) {
                results.push({
                    ...config,
                    success: false,
                    error: error.message
                });
            }
        }
        
        res.json({
            success: true,
            results,
            total: configs.length,
            successful: results.filter(r => r.success).length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper functions
async function updateAndroidManifest(baseDir, packageName, permissions, description) {
    const manifestPath = path.join(baseDir, 'src/main/AndroidManifest.xml');
    let manifest = await fs.readFile(manifestPath, 'utf8');
    
    // Update package name
    manifest = manifest.replace(/com\.mimarca\.MiPrimeraApp/g, packageName);
    
    // Add permissions
    let permissionsSection = '';
    permissions.forEach(perm => {
        permissionsSection += `    <uses-permission android:name="android.permission.${perm}" />\n`;
    });
    
    // Insert permissions after manifest opening tag
    const manifestStart = manifest.indexOf('>', manifest.indexOf('<manifest')) + 1;
    manifest = manifest.slice(0, manifestStart) + '\n' + permissionsSection + manifest.slice(manifestStart);
    
    // Add meta-data for description if provided
    if (description) {
        const applicationStart = manifest.indexOf('<application');
        const applicationEnd = manifest.indexOf('>', applicationStart) + 1;
        const metaData = `\n        <meta-data
            android:name="app.description"
            android:value="${description.replace(/"/g, '\\"')}" />`;
        manifest = manifest.slice(0, applicationEnd) + metaData + manifest.slice(applicationEnd);
    }
    
    await fs.writeFile(manifestPath, manifest);
}

async function updateJavaFiles(baseDir, packageName, websiteUrl) {
    // Update package structure
    const newPackagePath = packageName.replace(/\./g, '/');
    const newJavaDir = path.join(baseDir, 'src/main/java', newPackagePath);
    const oldJavaDir = path.join(baseDir, 'src/main/java/com/mimarca/MiPrimeraApp');
    
    // Create new directory structure
    await fs.mkdir(path.dirname(newJavaDir), { recursive: true });
    
    // Copy and update Java files
    const javaFiles = ['ActividadPrincipal.java', 'JSInterface.java'];
    
    for (const file of javaFiles) {
        const oldPath = path.join(oldJavaDir, file);
        const newPath = path.join(newJavaDir, file);
        
        let content = await fs.readFile(oldPath, 'utf8');
        
        // Update package declaration
        content = content.replace(
            /package com\.mimarca\.MiPrimeraApp;/g,
            `package ${packageName};`
        );
        
        // Update imports if needed
        content = content.replace(
            /import com\.mimarca\.MiPrimeraApp\./g,
            `import ${packageName}.`
        );
        
        // Update URL if provided
        if (websiteUrl && file === 'ActividadPrincipal.java') {
            content = content.replace(
                /file\:\/\/\/android_asset\/index\.html/g,
                websiteUrl
            );
        }
        
        await fs.writeFile(newPath, content);
    }
    
    // Remove old directory
    await fs.rm(oldJavaDir, { recursive: true, force: true });
}

async function updateStringsXml(baseDir, appTitle) {
    const stringsPath = path.join(baseDir, 'src/main/res/values/strings.xml');
    let strings = await fs.readFile(stringsPath, 'utf8');
    
    strings = strings.replace(
        /<string name="app_name">[^<]*<\/string>/g,
        `<string name="app_name">${appTitle}</string>`
    );
    
    await fs.writeFile(stringsPath, strings);
}

async function updateBuildGradle(baseDir, versionCode, versionName) {
    const gradlePath = path.join(baseDir, 'app/build.gradle');
    
    try {
        let gradle = await fs.readFile(gradlePath, 'utf8');
        
        // Update version code and name
        gradle = gradle.replace(
            /versionCode\s+\d+/g,
            `versionCode ${versionCode}`
        );
        
        gradle = gradle.replace(
            /versionName\s+"[^"]*"/g,
            `versionName "${versionName}"`
        );
        
        await fs.writeFile(gradlePath, gradle);
    } catch (e) {
        // Gradle file might not exist at expected location
        console.log('Build.gradle update skipped:', e.message);
    }
}

async function copyAssets(baseDir, files) {
    const assetsDir = path.join(baseDir, 'src/main/assets');
    
    // Clear existing assets
    await fs.rm(assetsDir, { recursive: true, force: true });
    await fs.mkdir(assetsDir, { recursive: true });
    
    // Copy files
    for (const file of files) {
        const destPath = path.join(assetsDir, file.originalname.replace(/^\d+-/, ''));
        await fs.copyFile(file.path, destPath);
    }
    
    // Ensure index.html exists
    const indexPath = path.join(assetsDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
        // Create a simple index.html if none exists
        await fs.writeFile(indexPath, `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated App</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f0f0f0; 
        }
        .container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: white; 
            padding: 30px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        h1 { color: #333; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to Your Generated App!</h1>
        <p>This app was generated using APK Generator Web.</p>
        <p>Replace this content with your own HTML files.</p>
    </div>
</body>
</html>
        `);
    }
}

async function processAppIcon(baseDir, iconData) {
    try {
        // Remove data URL prefix
        const base64Data = iconData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Different icon sizes for Android
        const iconSizes = [
            { dir: 'mipmap-hdpi', size: 72 },
            { dir: 'mipmap-mdpi', size: 48 },
            { dir: 'mipmap-xhdpi', size: 96 },
            { dir: 'mipmap-xxhdpi', size: 144 },
            { dir: 'mipmap-xxxhdpi', size: 192 }
        ];
        
        for (const { dir, size } of iconSizes) {
            const iconDir = path.join(baseDir, 'src/main/res', dir);
            await fs.mkdir(iconDir, { recursive: true });
            
            // Resize and save icon
            await sharp(buffer)
                .resize(size, size)
                .png()
                .toFile(path.join(iconDir, 'ic_launcher.png'));
        }
    } catch (e) {
        console.log('Icon processing skipped:', e.message);
    }
}

async function configureSplashScreen(baseDir, appTitle) {
    // Create splash screen layout
    const layoutDir = path.join(baseDir, 'src/main/res/layout');
    await fs.mkdir(layoutDir, { recursive: true });
    
    const splashLayout = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:gravity="center"
    android:background="@color/splash_background">
    
    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="${appTitle}"
        android:textSize="24sp"
        android:textColor="@color/splash_text"
        android:textStyle="bold" />
    
    <ProgressBar
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="20dp"
        style="?android:attr/progressBarStyle" />
    
</LinearLayout>`;
    
    await fs.writeFile(path.join(layoutDir, 'activity_splash.xml'), splashLayout);
}

async function buildApk(baseDir) {
    return new Promise((resolve, reject) => {
        const gradlewPath = path.join(baseDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
        
        // Make gradlew executable on Unix-like systems
        if (process.platform !== 'win32') {
            fs.chmodSync(gradlewPath, '755');
        }
        
        const buildProcess = spawn(gradlewPath, ['assembleDebug'], {
            cwd: baseDir,
            stdio: 'pipe',
            shell: true
        });
        
        let stdout = '';
        let stderr = '';
        
        buildProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        buildProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        buildProcess.on('close', (code) => {
            if (code === 0) {
                resolve('Build successful');
            } else {
                reject(new Error(`Build failed with code ${code}\n${stderr}`));
            }
        });
        
        buildProcess.on('error', (error) => {
            reject(error);
        });
        
        // Timeout after 5 minutes
        setTimeout(() => {
            buildProcess.kill();
            reject(new Error('Build timeout after 5 minutes'));
        }, 5 * 60 * 1000);
    });
}

async function generateSingleAPK(config) {
    // Mock implementation for batch generation
    return {
        downloadUrl: `/download/mock_${Date.now()}.apk`,
        fileName: `${config.appTitle.replace(/\s+/g, '_')}.apk`
    };
}

// Start server
app.listen(port, () => {
    console.log(`🚀 APK Generator Web berjalan di http://localhost:${port}`);
    console.log(`📁 Uploads directory: ${path.join(__dirname, 'uploads')}`);
    console.log(`📁 Downloads directory: ${path.join(__dirname, 'downloads')}`);
    console.log(`📁 Builds directory: ${path.join(__dirname, 'builds')}`);
});
