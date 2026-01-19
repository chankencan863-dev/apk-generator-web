// Global variables
let currentStep = 1;
let selectedPermissions = new Set();
let selectedSourceType = 'url';
let uploadedFiles = [];

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadPermissions();
    setupEventListeners();
    updateStepIndicator();
});

// Load available permissions
async function loadPermissions() {
    try {
        const response = await fetch('/api/permissions');
        const permissions = await response.json();
        
        const container = document.getElementById('permissionsContainer');
        container.innerHTML = '';
        
        permissions.forEach(perm => {
            const col = document.createElement('div');
            col.className = 'col-md-4 col-sm-6';
            col.innerHTML = `
                <div class="permission-badge" data-permission="${perm.id}" onclick="togglePermission('${perm.id}')">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="perm_${perm.id}">
                        <label class="form-check-label" for="perm_${perm.id}">
                            <strong>${perm.name}</strong><br>
                            <small class="text-muted">${perm.description}</small>
                        </label>
                    </div>
                </div>
            `;
            container.appendChild(col);
        });
    } catch (error) {
        console.error('Error loading permissions:', error);
    }
}

// Setup event listeners
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
        option.addEventListener('click', handleSourceTypeSelect);
    });
    
    // Form input updates
    document.getElementById('appTitle').addEventListener('input', updatePreview);
    document.getElementById('packageName').addEventListener('input', updatePreview);
    document.getElementById('websiteUrl').addEventListener('input', updatePreview);
    document.getElementById('assetsFolder').addEventListener('change', handleFileUpload);
    document.getElementById('customPermission').addEventListener('change', handleCustomPermission);
    
    // Generate button
    document.getElementById('generateBtn').addEventListener('click', generateAPK);
}

// Handle next step
function handleNextStep(e) {
    const currentStepId = `step${currentStep}`;
    const nextStepId = e.target.dataset.next;
    
    // Validate current step
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
}

// Handle previous step
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
}

// Validate step
function validateStep(step) {
    switch(step) {
        case 1:
            const title = document.getElementById('appTitle').value.trim();
            const packageName = document.getElementById('packageName').value.trim();
            
            if (!title) {
                alert('Mohon masukkan nama aplikasi!');
                return false;
            }
            
            if (!packageName || !packageName.includes('.')) {
                alert('Mohon masukkan package name yang valid (format: com.nama.aplikasi)');
                return false;
            }
            
            return true;
            
        case 2:
            if (selectedSourceType === 'url') {
                const url = document.getElementById('websiteUrl').value.trim();
                if (!url) {
                    alert('Mohon masukkan URL website!');
                    return false;
                }
                
                try {
                    new URL(url);
                } catch {
                    alert('Mohon masukkan URL yang valid!');
                    return false;
                }
            } else if (selectedSourceType === 'assets') {
                if (uploadedFiles.length === 0) {
                    alert('Mohon unggah file assets!');
                    return false;
                }
            }
            return true;
            
        default:
            return true;
    }
}

// Handle source type selection
function handleSourceTypeSelect(e) {
    const sourceType = e.currentTarget.dataset.type;
    selectedSourceType = sourceType;
    
    // Update UI
    document.querySelectorAll('.source-option').forEach(option => {
        option.classList.remove('border-primary');
    });
    e.currentTarget.classList.add('border-primary');
    
    // Show/hide relevant inputs
    if (sourceType === 'url') {
        document.querySelector('.url-input').classList.remove('d-none');
        document.querySelector('.file-input').classList.add('d-none');
    } else {
        document.querySelector('.url-input').classList.add('d-none');
        document.querySelector('.file-input').classList.remove('d-none');
    }
}

// Handle file upload
function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    uploadedFiles = files;
    
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    
    files.slice(0, 5).forEach(file => {
        const div = document.createElement('div');
        div.className = 'text-truncate';
        div.textContent = `📄 ${file.name} (${formatFileSize(file.size)})`;
        fileList.appendChild(div);
    });
    
    if (files.length > 5) {
        const more = document.createElement('div');
        more.className = 'text-muted';
        more.textContent = `... dan ${files.length - 5} file lainnya`;
        fileList.appendChild(more);
    }
}

// Handle custom permission
function handleCustomPermission(e) {
    const customPerms = e.target.value.split(',').map(p => p.trim()).filter(p => p);
    
    customPerms.forEach(perm => {
        selectedPermissions.add(perm.toUpperCase());
    });
    
    updatePreview();
}

// Toggle permission
function togglePermission(permission) {
    const badge = document.querySelector(`[data-permission="${permission}"]`);
    const checkbox = document.getElementById(`perm_${permission}`);
    
    if (selectedPermissions.has(permission)) {
        selectedPermissions.delete(permission);
        badge.classList.remove('active');
        checkbox.checked = false;
    } else {
        selectedPermissions.add(permission);
        badge.classList.add('active');
        checkbox.checked = true;
    }
    
    updatePreview();
}

// Update step indicator
function updateStepIndicator() {
    const steps = document.querySelectorAll('.step');
    const lines = document.querySelectorAll('.step-line');
    
    steps.forEach((step, index) => {
        const stepNum = index + 1;
        if (stepNum < currentStep) {
            step.classList.add('active');
            if (lines[index - 1]) {
                lines[index - 1].classList.add('active');
            }
        } else if (stepNum === currentStep) {
            step.classList.add('active');
            if (lines[index - 1]) {
                lines[index - 1].classList.add('active');
            }
        } else {
            step.classList.remove('active');
            if (lines[index - 1]) {
                lines[index - 1].classList.remove('active');
            }
        }
    });
}

// Update preview
function updatePreview() {
    const title = document.getElementById('appTitle').value || 'Nama Aplikasi';
    const packageName = document.getElementById('packageName').value || 'com.example.app';
    const websiteUrl = document.getElementById('websiteUrl').value || '';
    
    document.getElementById('previewTitle').textContent = title;
    document.getElementById('previewPackage').textContent = packageName;
    
    // Update source type badge
    const sourceTypeBadge = document.getElementById('previewSourceType');
    sourceTypeBadge.textContent = selectedSourceType === 'url' ? 'Website' : 'Assets';
    sourceTypeBadge.className = selectedSourceType === 'url' ? 'badge bg-primary me-2' : 'badge bg-success me-2';
    
    // Update permission count
    const permCount = selectedPermissions.size + 
        (document.getElementById('customPermission').value ? 
         document.getElementById('customPermission').value.split(',').length : 0);
    document.getElementById('previewPermissionCount').textContent = `${permCount} Izin`;
}

// Generate APK
async function generateAPK() {
    const formData = new FormData();
    
    // Collect form data
    formData.append('appTitle', document.getElementById('appTitle').value);
    formData.append('packageName', document.getElementById('packageName').value);
    formData.append('sourceType', selectedSourceType);
    formData.append('websiteUrl', document.getElementById('websiteUrl').value);
    formData.append('versionCode', document.getElementById('versionCode').value);
    formData.append('versionName', document.getElementById('versionName').value);
    
    // Add permissions
    const allPermissions = Array.from(selectedPermissions);
    const customPerms = document.getElementById('customPermission').value
        .split(',')
        .map(p => p.trim())
        .filter(p => p);
    
    allPermissions.push(...customPerms);
    formData.append('permissions', JSON.stringify(allPermissions));
    
    // Add files if assets mode
    if (selectedSourceType === 'assets' && uploadedFiles.length > 0) {
        uploadedFiles.forEach(file => {
            formData.append('assets', file);
        });
    }
    
    // Show progress
    const progressBar = document.getElementById('generationProgress');
    const logOutput = document.getElementById('logOutput');
    const generateBtn = document.getElementById('generateBtn');
    
    progressBar.classList.remove('d-none');
    logOutput.classList.remove('d-none');
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Generating...';
    
    // Update progress bar
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 5;
        if (progress <= 95) {
            progressBar.querySelector('.progress-bar').style.width = `${progress}%`;
        }
    }, 1000);
    
    // Add log messages
    function addLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const color = type === 'error' ? '#ff6b6b' : type === 'success' ? '#51cf66' : '#339af0';
        const logEntry = `<span style="color: ${color}">[${timestamp}] ${message}</span><br>`;
        logOutput.innerHTML += logEntry;
        logOutput.scrollTop = logOutput.scrollHeight;
    }
    
    addLog('Memulai proses generate APK...');
    addLog('Menyiapkan data aplikasi...');
    
    try {
        // Send request to backend
        const response = await fetch('/api/generate', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        clearInterval(progressInterval);
        progressBar.querySelector('.progress-bar').style.width = '100%';
        
        if (result.success) {
            addLog('✓ APK berhasil digenerate!', 'success');
            addLog(`📁 File APK siap didownload: ${result.downloadUrl}`, 'success');
            
            // Show download modal
            setTimeout(() => {
                document.getElementById('downloadLink').href = result.downloadUrl;
                const downloadModal = new bootstrap.Modal(document.getElementById('downloadModal'));
                downloadModal.show();
            }, 1000);
        } else {
            addLog(`✗ Error: ${result.error}`, 'error');
        }
    } catch (error) {
        clearInterval(progressInterval);
        addLog(`✗ Error: ${error.message}`, 'error');
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-bolt me-2"></i> Generate APK';
    }
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export functions to global scope
window.togglePermission = togglePermission;
