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
            previewIcon.style.background
