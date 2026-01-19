// Global state
let currentStep = 1;
let selectedPermissions = new Set(['INTERNET']);
let selectedSourceType = 'url';
let uploadedFiles = [];
let systemStatus = {};
let generationLogs = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    await loadPermissions();
    await checkSystemRequirements();
    setupEventListeners();
    updateStepIndicator();
    updatePreview();
    
    // Show welcome message
    addLog('Sistem APK Generator siap digunakan!', 'success');
}

async function loadPermissions() {
    try {
        const response = await fetch('/api/permissions');
        const permissions = await response.json();
        
        const container = document.getElementById('permissionsContainer');
        container.innerHTML = '';
        
        permissions.forEach(perm => {
            const col = document.createElement('div');
            col.className = 'col-md-4 col-sm-6 mb-3';
            col.innerHTML = `
                <div class="card permission-card h-100 ${selectedPermissions.has(perm.id) ? 'border-primary' : ''}" 
                     onclick="togglePermission('${perm.id}')">
                    <div class="card-body">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" 
                                   id="perm_${perm.id}" 
                                   ${selectedPermissions.has(perm.id) ? 'checked' : ''}>
                            <label class="form-check-label w-100" for="perm_${perm.id}">
                                <strong>${perm.name}</strong><br>
                                <small class="text-muted">${perm.description}</small>
                            </label>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(col);
        });
    } catch (error) {
        console.error('Error loading permissions:', error);
        showAlert('Gagal memuat daftar izin. Menggunakan daftar default.', 'warning');
    }
}

async function checkSystemRequirements() {
    try {
        const response = await fetch('/api/check-system');
        const result = await response.json();
        
        if (result.success) {
            systemStatus = result.checks;
            
            // Show system status
            const statusContainer = document.getElementById('systemStatus');
            if (statusContainer) {
                let statusHtml = '<div class="system-status">';
                statusHtml += `<div class="mb-2"><strong>Status Sistem:</strong></div>`;
                
                const checks = [
                    { name: 'Git', key: 'git', icon: 'fa-code-branch' },
                    { name: 'Java', key: 'java', icon: 'fa-coffee' },
                    { name: 'Node.js', key: 'node', icon: 'fa-node-js' },
                    { name: 'Memory', key: 'memory', icon: 'fa-memory' },
                    { name: 'Disk', key: 'disk', icon: 'fa-hdd' }
                ];
                
                checks.forEach(check => {
                    const status = systemStatus[check.key];
                    const color = status ? 'text-success' : 'text-danger';
                    const icon = status ? 'fa-check-circle' : 'fa-times-circle';
                    
                    statusHtml += `
                        <div class="d-flex align-items-center mb-1">
                            <i class="fas ${check.icon} me-2"></i>
                            <span class="me-2">${check.name}:</span>
                            <i class="fas ${icon} ${color}"></i>
                        </div>
                    `;
                });
                
                statusHtml += '</div>';
                statusContainer.innerHTML = statusHtml;
            }
            
            if (!systemStatus.git || !systemStatus.java) {
                showAlert('Beberapa persyaratan sistem belum terpenuhi. APK generation mungkin gagal.', 'warning');
            }
        }
    } catch (error) {
        console.error('Error checking system:', error);
    }
}

function setupEventListeners() {
    // Step navigation
    document.querySelectorAll('.next-step').forEach(btn => {
        btn.addEventListener('click', handleNextStep);
    });
    
    document.querySelectorAll('.prev-step').forEach(btn => {
        btn.addEventListener('click', handlePrevStep);
    });
    
    // Source type selection
    document.querySelectorAll('.source-option').forEach(option => {
        option.addEventListener('click', function() {
            selectedSourceType = this.dataset.type;
            handleSourceTypeSelect(this);
        });
    });
    
    // Form inputs
    const inputs = ['appTitle', 'packageName', 'websiteUrl', 'customPermission', 
                    'versionCode', 'versionName', 'appDescription'];
    
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updatePreview);
        }
    });
    
    // File upload
    document.getElementById('assetsFolder').addEventListener('change', handleFileUpload);
    
    // App icon
    document.getElementById('appIcon').addEventListener('change', handleIconUpload);
    
    // Generate button
    document.getElementById('generateBtn').addEventListener('click', generateAPK);
    
    // Quick generate button (instant)
    document.getElementById('quickGenerateBtn')?.addEventListener('click', quickGenerate);
    
    // Download button
    document.getElementById('downloadLink').addEventListener('click', function(e) {
        addLog('Memulai download APK...', 'info');
    });
    
    // Custom permission input
    document.getElementById('customPermission').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const perms = this.value.split(',').map(p => p.trim()).filter(p => p);
            perms.forEach(p => selectedPermissions.add(p.toUpperCase()));
            this.value = '';
            updatePreview();
            showAlert(`${perms.length} izin kustom ditambahkan`, 'success');
        }
    });
}

function handleNextStep(e) {
    const currentStepId = `step${currentStep}`;
    const nextStepId = e.target.dataset.next;
    
    if (!validateStep(currentStep)) {
        return;
    }
    
    // Hide current step
    document.getElementById(currentStepId).classList.add('d-none');
    
    // Show next step
    document.getElementById(nextStepId).classList.remove('d-none');
    
    // Update current step
    currentStep = parseInt(nextStepId.replace('step', ''));
    updateStepIndicator();
    updatePreview();
    
    // Scroll to top of step
    document.getElementById(nextStepId).scrollIntoView({ behavior: 'smooth' });
}

function handlePrevStep(e) {
    const currentStepId = `step${currentStep}`;
    const prevStepId = e.target.dataset.prev;
    
    // Hide current step
    document.getElementById(currentStepId).classList.add('d-none');
    
    // Show previous step
    document.getElementById(prevStepId).classList.remove('d-none');
    
    // Update current step
    currentStep = parseInt(prevStepId.replace('step', ''));
    updateStepIndicator();
    
    // Scroll to top of step
    document.getElementById(prevStepId).scrollIntoView({ behavior: 'smooth' });
}

function validateStep(step) {
    switch(step) {
        case 1:
            const title = document.getElementById('appTitle').value.trim();
            const packageName = document.getElementById('packageName').value.trim();
            
            if (!title) {
                showAlert('Mohon masukkan nama aplikasi!', 'warning');
                return false;
            }
            
            if (!packageName || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)) {
                showAlert('Mohon masukkan package name yang valid (contoh: com.nama.aplikasi)', 'warning');
                return false;
            }
            
            return true;
            
        case 2:
            if (selectedSourceType === 'url') {
                const url = document.getElementById('websiteUrl').value.trim();
                if (!url) {
                    showAlert('Mohon masukkan URL website!', 'warning');
                    return false;
                }
                
                try {
                    new URL(url);
                } catch {
                    showAlert('Mohon masukkan URL yang valid!', 'warning');
                    return false;
                }
            } else if (selectedSourceType === 'assets') {
                if (uploadedFiles.length === 0) {
                    showAlert('Mohon unggah file assets!', 'warning');
                    return false;
                }
            }
            return true;
            
        case 3:
            if (selectedPermissions.size === 0) {
                const proceed = confirm('Anda belum memilih izin apapun. Lanjutkan tanpa izin?');
                return proceed;
            }
            return true;
            
        default:
            return true;
    }
}

function handleSourceTypeSelect(element) {
    // Update UI
    document.querySelectorAll('.source-option').forEach(option => {
        option.classList.remove('border-primary', 'shadow');
    });
    element.classList.add('border-primary', 'shadow');
    
    // Show/hide relevant inputs
    const urlInput = document.querySelector('.url-input');
    const fileInput = document.querySelector('.file-input');
    
    if (selectedSourceType === 'url') {
        urlInput.classList.remove('d-none');
        fileInput.classList.add('d-none');
    } else {
        urlInput.classList.add('d-none');
        fileInput.classList.remove('d-none');
    }
    
    updatePreview();
}

function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    uploadedFiles = files;
    
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    
    let totalSize = 0;
    files.slice(0, 5).forEach((file, index) => {
        totalSize += file.size;
        const div = document.createElement('div');
        div.className = 'd-flex justify-content-between align-items-center mb-1';
        div.innerHTML = `
            <span class="text-truncate me-2">
                <i class="fas ${getFileIcon(file.name)} me-1"></i>
                ${file.name}
            </span>
            <small class="text-muted">${formatFileSize(file.size)}</small>
        `;
        fileList.appendChild(div);
    });
    
    if (files.length > 5) {
        const more = document.createElement('div');
        more.className = 'text-muted text-center';
        more.textContent = `... dan ${files.length - 5} file lainnya`;
        fileList.appendChild(more);
    }
    
    // Show total size
    const totalDiv = document.createElement('div');
    totalDiv.className = 'mt-2 text-center border-top pt-2';
    totalDiv.innerHTML = `<strong>Total: ${files.length} file (${formatFileSize(totalSize)})</strong>`;
    fileList.appendChild(totalDiv);
    
    updatePreview();
}

function handleIconUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.match('image.*')) {
        showAlert('Hanya file gambar yang diperbolehkan!', 'warning');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showAlert('Ukuran file maksimal 5MB!', 'warning');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const iconData = e.target.result;
        
        // Update preview icon
        const previewIcon = document.getElementById('previewIcon');
        if (previewIcon) {
            previewIcon.style.backgroundImage = `url(${iconData})`;
            previewIcon.innerHTML = '';
        }
        
        // Store for generation
        window.iconData = iconData;
        
        showAlert('Icon berhasil diunggah!', 'success');
    };
    
    reader.readAsDataURL(file);
}

function togglePermission(permission) {
    const card = document.querySelector(`.permission-card[onclick*="${permission}"]`);
    const checkbox = document.getElementById(`perm_${permission}`);
    
    if (selectedPermissions.has(permission)) {
        selectedPermissions.delete(permission);
        card.classList.remove('border-primary');
        checkbox.checked = false;
    } else {
        selectedPermissions.add(permission);
        card.classList.add('border-primary');
        checkbox.checked = true;
    }
    
    updatePreview();
}

function updateStepIndicator() {
    const steps = document.querySelectorAll('.step');
    const lines = document.querySelectorAll('.step-line');
    
    steps.forEach((step, index) => {
        const stepNum = index + 1;
        if (stepNum < currentStep) {
            step.classList.add('active');
            if (lines[index]) {
                lines[index].classList.add('active');
            }
        } else if (stepNum === currentStep) {
            step.classList.add('active');
            if (lines[index]) {
                lines[index].classList.add('active');
            }
        } else {
            step.classList.remove('active');
            if (lines[index]) {
                lines[index].classList.remove('active');
            }
        }
    });
}

function updatePreview() {
    // Update app info
    const title = document.getElementById('appTitle').value || 'Nama Aplikasi';
    const packageName = document.getElementById('packageName').value || 'com.example.app';
    const description = document.getElementById('appDescription').value || 'Aplikasi Android generated';
    
    document.getElementById('previewTitle').textContent = title;
    document.getElementById('previewPackage').textContent = packageName;
    document.getElementById('previewDescription').textContent = description;
    
    // Update source type
    const sourceTypeBadge = document.getElementById('previewSourceType');
    if (sourceTypeBadge) {
        sourceTypeBadge.textContent = selectedSourceType === 'url' ? 'Website' : 'Assets';
        sourceTypeBadge.className = selectedSourceType === 'url' ? 
            'badge bg-primary me-2' : 'badge bg-success me-2';
    }
    
    // Update URL preview
    if (selectedSourceType === 'url') {
        const url = document.getElementById('websiteUrl').value;
        document.getElementById('previewUrl').textContent = url || 'https://example.com';
    } else {
        document.getElementById('previewUrl').textContent = `${uploadedFiles.length} file assets`;
    }
    
    // Update permission count
    const permCount = selectedPermissions.size;
    document.getElementById('previewPermissionCount').textContent = `${permCount} Izin`;
    
    // Update version
    const versionCode = document.getElementById('versionCode').value || '1';
    const versionName = document.getElementById('versionName').value || '1.0';
    document.getElementById('previewVersion').textContent = `v${versionName} (${versionCode})`;
}

async function generateAPK() {
    if (!validateStep(4)) {
        return;
    }
    
    // Collect form data
    const formData = new FormData();
    
    // Basic info
    formData.append('appTitle', document.getElementById('appTitle').value);
    formData.append('packageName', document.getElementById('packageName').value);
    formData.append('appDescription', document.getElementById('appDescription').value);
    
    // Source type
    formData.append('sourceType', selectedSourceType);
    if (selectedSourceType === 'url') {
        formData.append('websiteUrl', document.getElementById('websiteUrl').value);
    } else {
        // Add uploaded files
        uploadedFiles.forEach(file => {
            formData.append('assets', file);
        });
    }
    
    // Permissions
    formData.append('permissions', JSON.stringify(Array.from(selectedPermissions)));
    
    // Version
    formData.append('versionCode', document.getElementById('versionCode').value);
    formData.append('versionName', document.getElementById('versionName').value);
    
    // Options
    formData.append('enableSplash', document.getElementById('enableSplash').checked);
    
    // Icon
    if (window.iconData) {
        formData.append('iconData', window.iconData);
    }
    
    // Custom permissions
    const customPerms = document.getElementById('customPermission').value;
    if (customPerms) {
        const customPermsArray = customPerms.split(',').map(p => p.trim()).filter(p => p);
        formData.append('customPermissions', JSON.stringify(customPermsArray));
    }
    
    // Show progress UI
    showGenerationProgress();
    addLog('Memulai proses generate APK...', 'info');
    addLog('Menyiapkan data aplikasi...', 'info');
    
    try {
        // Send request to backend
        const response = await fetch('/api/generate', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Show success logs
            if (result.logs) {
                result.logs.forEach(log => {
                    if (!log.includes('ERROR')) {
                        addLog(log, 'success');
                    }
                });
            }
            
            addLog('✓ APK berhasil digenerate!', 'success');
            addLog(`📁 Ukuran file: ${formatFileSize(result.fileSize)}`, 'info');
            addLog(`⏱️ Waktu build: ${result.buildTime} detik`, 'info');
            
            // Show download button
            setTimeout(() => {
                showDownloadModal(result.downloadUrl, result.fileName);
            }, 1500);
            
        } else {
            addLog(`✗ Error: ${result.error}`, 'error');
            if (result.logs) {
                result.logs.forEach(log => {
                    if (log.includes('ERROR')) {
                        addLog(log, 'error');
                    }
                });
            }
            showAlert('Gagal generate APK: ' + result.error, 'danger');
        }
    } catch (error) {
        addLog(`✗ Network error: ${error.message}`, 'error');
        showAlert('Gagal terhubung ke server: ' + error.message, 'danger');
    } finally {
        // Hide progress bar after delay
        setTimeout(() => {
            document.getElementById('generationProgress').classList.add('d-none');
            document.getElementById('generateBtn').disabled = false;
            document.getElementById('generateBtn').innerHTML = '<i class="fas fa-bolt me-2"></i> Generate APK';
        }, 2000);
    }
}

async function quickGenerate() {
    // Quick generate with default values
    const defaultTitle = 'My Quick App';
    const defaultPackage = 'com.quick.app';
    
    document.getElementById('appTitle').value = defaultTitle;
    document.getElementById('packageName').value = defaultPackage;
    
    // Use URL if provided, otherwise use default
    const urlInput = document.getElementById('websiteUrl');
    if (!urlInput.value) {
        urlInput.value = 'https://example.com';
    }
    
    selectedSourceType = 'url';
    selectedPermissions = new Set(['INTERNET']);
    
    // Update UI
    document.querySelectorAll('.source-option').forEach(option => {
        if (option.dataset.type === 'url') {
            option.classList.add('border-primary', 'shadow');
        } else {
            option.classList.remove('border-primary', 'shadow');
        }
    });
    
    // Skip to final step
    currentStep = 4;
    updateStepIndicator();
    
    // Show step 4
    document.querySelectorAll('.step-content').forEach(step => {
        step.classList.add('d-none');
    });
    document.getElementById('step4').classList.remove('d-none');
    
    updatePreview();
    
    // Auto-generate after 1 second
    setTimeout(() => {
        showAlert('Quick generate dimulai...', 'info');
        generateAPK();
    }, 1000);
}

function showGenerationProgress() {
    const progressBar = document.getElementById('generationProgress');
    const logOutput = document.getElementById('logOutput');
    const generateBtn = document.getElementById('generateBtn');
    
    // Reset UI
    progressBar.classList.remove('d-none');
    logOutput.classList.remove('d-none');
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Generating...';
    
    // Clear previous logs
    generationLogs = [];
    logOutput.innerHTML = '';
    
    // Animate progress bar
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress <= 90) {
            const progressElement = progressBar.querySelector('.progress-bar');
            progressElement.style.width = `${progress}%`;
            progressElement.textContent = `${Math.round(progress)}%`;
        }
    }, 500);
    
    // Store interval for cleanup
    window.progressInterval = progressInterval;
}

function showDownloadModal(downloadUrl, fileName) {
    // Update download link
    const downloadLink = document.getElementById('downloadLink');
    downloadLink.href = downloadUrl;
    downloadLink.download = fileName;
    
    // Update file info
    document.getElementById('downloadFileName').textContent = fileName;
    
    // Show modal
    const downloadModal = new bootstrap.Modal(document.getElementById('downloadModal'));
    downloadModal.show();
    
    // Clear progress interval
    if (window.progressInterval) {
        clearInterval(window.progressInterval);
        window.progressInterval = null;
    }
    
    // Reset progress bar
    const progressBar = document.getElementById('generationProgress');
    const progressElement = progressBar.querySelector('.progress-bar');
    progressElement.style.width = '100%';
    progressElement.textContent = '100%';
    
    // Change to success color
    progressBar.querySelector('.progress-bar').classList.remove('bg-primary');
    progressBar.querySelector('.progress-bar').classList.add('bg-success');
}

function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
        info: '#339af0',
        success: '#51cf66',
        warning: '#ff922b',
        error: '#ff6b6b'
    };
    
    const color = colors[type] || colors.info;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : '▶';
    
    const logEntry = `<div style="color: ${color}; font-family: 'Courier New', monospace; margin-bottom: 2px;">
        <span style="opacity: 0.7">[${timestamp}]</span> ${icon} ${message}
    </div>`;
    
    const logOutput = document.getElementById('logOutput');
    logOutput.innerHTML += logEntry;
    logOutput.scrollTop = logOutput.scrollHeight;
    
    generationLogs.push({ timestamp, type, message });
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    const icons = {
        html: 'fa-code',
        css: 'fa-css3',
        js: 'fa-js',
        json: 'fa-file-code',
        png: 'fa-file-image',
        jpg: 'fa-file-image',
        jpeg: 'fa-file-image',
        gif: 'fa-file-image',
        svg: 'fa-file-image',
        ico: 'fa-file-image',
        mp3: 'fa-file-audio',
        mp4: 'fa-file-video',
        pdf: 'fa-file-pdf',
        zip: 'fa-file-archive',
        txt: 'fa-file-alt'
    };
    
    return icons[ext] || 'fa-file';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Make functions globally available
window.togglePermission = togglePermission;
window.quickGenerate = quickGenerate;
