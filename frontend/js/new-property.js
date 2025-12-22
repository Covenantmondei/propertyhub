// New property page JavaScript

document.addEventListener('DOMContentLoaded', () => {
    console.log('New property page loaded');
    
    // Check if user is authenticated and is an agent
    const user = getUser();
    if (!isAuthenticated() || !user) {
        showNotification('Please login as an agent to add a property', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    if (user.role !== 'agent') {
        showNotification('Only agents can create property listings', 'error');
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 2000);
        return;
    }

    const form = document.getElementById('new-property-form');
    form.addEventListener('submit', handleSubmit);
    
    setupImageUpload();
    setupFormValidation();
});

async function handleSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');
    
    // Disable button and show spinner
    submitBtn.disabled = true;
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');

    try {
        // Build property data object matching backend schema
        const propertyData = {
            title: document.getElementById('title').value.trim(),
            description: document.getElementById('description').value.trim(),
            property_type: document.getElementById('property_type').value,
            listing_type: document.getElementById('listing_type').value,
            price: parseFloat(document.getElementById('price').value),
            address: document.getElementById('address').value.trim(),
            city: document.getElementById('city').value.trim(),
            state: document.getElementById('state').value.trim(),
            country: document.getElementById('country').value.trim() || 'NIG'
        };
        
        // Optional fields with proper type conversion
        const bedroomsVal = document.getElementById('bedrooms')?.value;
        if (bedroomsVal && bedroomsVal !== '') {
            propertyData.bedrooms = parseInt(bedroomsVal);
        }
        
        const bathroomsVal = document.getElementById('bathrooms')?.value;
        if (bathroomsVal && bathroomsVal !== '') {
            propertyData.bathrooms = parseInt(bathroomsVal);
        }
        
        const areaVal = document.getElementById('area_sqft')?.value;
        if (areaVal && areaVal !== '') {
            propertyData.area_sqft = parseFloat(areaVal);
        }
        
        const yearVal = document.getElementById('year_built')?.value;
        if (yearVal && yearVal !== '') {
            propertyData.year_built = parseInt(yearVal);
        }
        
        const parkingVal = document.getElementById('parking_spaces')?.value;
        if (parkingVal && parkingVal !== '') {
            propertyData.parking_spaces = parseInt(parkingVal);
        }
        
        const zipVal = document.getElementById('zip_code')?.value;
        if (zipVal && zipVal.trim() !== '') {
            propertyData.zip_code = zipVal.trim();
        }
        
        // Handle amenities - convert to JSON array string
        const amenitiesText = document.getElementById('amenities')?.value;
        if (amenitiesText && amenitiesText.trim() !== '') {
            const amenitiesList = amenitiesText.split('\n')
                .map(a => a.trim())
                .filter(a => a !== '');
            if (amenitiesList.length > 0) {
                propertyData.amenities = JSON.stringify(amenitiesList);
            }
        }

        // Validate required fields
        if (!propertyData.title || !propertyData.description || !propertyData.property_type || 
            !propertyData.listing_type || !propertyData.address || 
            !propertyData.city || !propertyData.state) {
            showNotification('Please fill in all required fields', 'error');
            return;
        }

        if (isNaN(propertyData.price) || propertyData.price <= 0) {
            showNotification('Please enter a valid price greater than 0', 'error');
            return;
        }

        console.log('Submitting property:', propertyData);
        
        // Create property via API
        const response = await apiCall('/properties/create', {
            method: 'POST',
            body: JSON.stringify(propertyData)
        });

        console.log('Property created:', response);
        showNotification('Property created successfully!', 'success');
        
        // Upload images if any
        const imageFiles = document.getElementById('images')?.files;
        if (imageFiles && imageFiles.length > 0) {
            await uploadPropertyImages(response.id, imageFiles);
        }
        
        // Show success message with info about approval
        showNotification('Property submitted for admin approval. You will be notified once approved.', 'info');
        
        // Redirect to agent dashboard after a short delay
        setTimeout(() => {
            window.location.href = 'agent-dashboard.html';
        }, 2500);
    } catch (error) {
        console.error('Failed to add property:', error);
        const errorMessage = error.message || 'Please try again';
        showNotification(`Failed to add property: ${errorMessage}`, 'error');
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
    }
}

async function uploadPropertyImages(propertyId, files) {
    try {
        showNotification('Uploading images...', 'info');
        
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }

        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/properties/${propertyId}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Images uploaded:', result);
        showNotification(`${result.images_uploaded} image(s) uploaded successfully!`, 'success');
    } catch (error) {
        console.error('Failed to upload images:', error);
        showNotification('Property created but failed to upload some images', 'warning');
    }
}

// Image upload preview functionality
function setupImageUpload() {
    const imageInput = document.getElementById('images');
    const previewContainer = document.getElementById('preview-images');

    if (imageInput && previewContainer) {
        imageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            previewContainer.innerHTML = '';

            if (files.length > 0) {
                previewContainer.style.display = 'grid';
                
                files.forEach((file, index) => {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const div = document.createElement('div');
                            div.className = 'image-preview-item';
                            div.innerHTML = `
                                <img src="${e.target.result}" alt="Preview ${index + 1}">
                                ${index === 0 ? '<span class="primary-badge">Primary</span>' : ''}
                            `;
                            previewContainer.appendChild(div);
                        };
                        reader.readAsDataURL(file);
                    }
                });
            } else {
                previewContainer.style.display = 'none';
            }
        });
    }
}

// Setup real-time form validation
function setupFormValidation() {
    // Price validation
    const priceInput = document.getElementById('price');
    if (priceInput) {
        priceInput.addEventListener('blur', () => {
            const value = parseFloat(priceInput.value);
            if (isNaN(value) || value <= 0) {
                priceInput.setCustomValidity('Price must be greater than 0');
                priceInput.reportValidity();
            } else {
                priceInput.setCustomValidity('');
            }
        });
    }

    // Year built validation
    const yearInput = document.getElementById('year_built');
    if (yearInput) {
        yearInput.addEventListener('blur', () => {
            const value = parseInt(yearInput.value);
            const currentYear = new Date().getFullYear();
            if (value && (value < 1800 || value > currentYear + 5)) {
                yearInput.setCustomValidity(`Year must be between 1800 and ${currentYear + 5}`);
                yearInput.reportValidity();
            } else {
                yearInput.setCustomValidity('');
            }
        });
    }

    // Numeric field validation (prevent negative values)
    const numericFields = ['bedrooms', 'bathrooms', 'area_sqft', 'parking_spaces'];
    numericFields.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.addEventListener('input', () => {
                if (parseFloat(input.value) < 0) {
                    input.value = 0;
                }
            });
        }
    });
}
