// app.js
(function() {
    // --- Initialization ---
    // Check if config is loaded
    if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || window.SUPABASE_CONFIG.url.includes("PASTE_YOUR")) {
        console.error("SUPABASE_CONFIG is missing or not configured. Check your config.js file.");
        // Display error on the page if possible
        const body = document.querySelector('body');
        if (body) {
            body.innerHTML = '<div style="color:red; text-align:center; margin-top:50px;"><h1>Configuration Error</h1><p>Supabase URL and Anon Key are not set in config.js. Please follow the setup guide.</p></div>';
        }
        return; // Stop execution
    }

    // Create a single Supabase client for the whole app
    const supabase = window.supabase.createClient(
        window.SUPABASE_CONFIG.url,
        window.SUPABASE_CONFIG.anonKey
    );

    // Detect which page we are on
    const isAdminPage = window.location.pathname.includes('admin.html');
    const isPublicPage = !isAdminPage;

    // --- Public Page Logic (index.html) ---
    if (isPublicPage) {
        const form = document.getElementById('appointment-form');
        const submitBtn = document.getElementById('submit-btn');
        const messageBox = document.getElementById('message-box');

        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();

                // Get form values
                const name = document.getElementById('name').value.trim();
                const mobile = document.getElementById('mobile').value.trim();

                // Basic validation
                if (!name || !mobile) {
                    showMessage('Please fill in both your name and mobile number.', 'error', messageBox);
                    return;
                }

                // Disable button and show loading state
                submitBtn.disabled = true;
                submitBtn.textContent = 'Submitting...';
                messageBox.style.display = 'none';

                // Insert data into Supabase
                // RLS policy ensures anon users can ONLY insert name and mobile
                const { data, error } = await supabase
                    .from('appointment_requests')
                    .insert([
                        { name: name, mobile: mobile }
                    ]);

                // Re-enable button
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Request';

                if (error) {
                    console.error('Submission error:', error);
                    showMessage('Submission failed. Please try again later.', 'error', messageBox);
                } else {
                    showMessage('Thank you! We received your request. Our team will call you soon.', 'success', messageBox);
                    form.reset(); // Clear the form
                }
            });
        }
    }

    // --- Admin Page Logic (admin.html) ---
    if (isAdminPage) {
        const loginSection = document.getElementById('login-section');
        const dashboardSection = document.getElementById('dashboard-section');
        const loginForm = document.getElementById('login-form');
        const loginError = document.getElementById('login-error');
        const logoutBtn = document.getElementById('logout-btn');
        const adminMessageBox = document.getElementById('admin-message-box');

        // Check if user is already logged in
        checkSession();

        // Attach login form event listener
        if (loginForm) {
            loginForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const loginBtn = document.getElementById('login-btn');
                
                loginBtn.disabled = true;
                loginBtn.textContent = 'Logging in...';
                loginError.style.display = 'none';

                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                loginBtn.disabled = false;
                loginBtn.textContent = 'Log In';

                if (error) {
                    console.error('Login error:', error);
                    loginError.textContent = 'Invalid email or password.';
                    loginError.style.display = 'block';
                } else {
                    // Login successful, check if user is an admin in the public.admins table
                    const { data: adminData, error: adminError } = await supabase
                        .from('admins')
                        .select('user_id')
                        .eq('user_id', data.user.id)
                        .single();

                    if (adminError || !adminData) {
                        // User is logged in via Auth but is not in the admins table
                        console.error('Not an authorized admin:', adminError);
                        await supabase.auth.signOut(); // Log them out
                        loginError.textContent = 'Access denied. You are not an authorized admin.';
                        loginError.style.display = 'block';
                    } else {
                        // User is a verified admin. Proceed to dashboard.
                        showDashboard();
                    }
                }
            });
        }

        // Attach logout button event listener
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await supabase.auth.signOut();
                showLogin();
            });
        }

        // Function to check if a session exists
        async function checkSession() {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                // Session exists, verify against admins table
                const { data, error } = await supabase
                    .from('admins')
                    .select('user_id')
                    .eq('user_id', session.user.id)
                    .single();

                if (!error && data) {
                    showDashboard();
                } else {
                    // Session exists but user is not an admin, force logout
                    await supabase.auth.signOut();
                    showLogin();
                }
            } else {
                showLogin();
            }
        }

        function showLogin() {
            loginSection.style.display = 'block';
            dashboardSection.style.display = 'none';
        }

        function showDashboard() {
            loginSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            loadRequests();
        }

        // Function to load and display appointment requests
        async function loadRequests() {
            const container = document.getElementById('requests-container');
            container.innerHTML = '<p>Loading requests...</p>';
            showAdminMessage('', ''); // Clear any previous messages

            const { data: requests, error } = await supabase
                .from('appointment_requests')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading requests:', error);
                container.innerHTML = '<p class="error-message">Failed to load requests. Make sure you are an admin.</p>';
                return;
            }

            if (!requests || requests.length === 0) {
                container.innerHTML = '<p>No appointment requests found.</p>';
                return;
            }

            // Render the requests
            container.innerHTML = requests.map(request => createRequestCard(request)).join('');

            // Attach event listeners to all the action buttons inside each card
            attachCardEventListeners();
        }

        function createRequestCard(request) {
            const date = new Date(request.created_at).toLocaleString();
            return `
                <div class="request-card" data-id="${request.id}">
                    <h3>${escapeHtml(request.name)}</h3>
                    <p><strong>Mobile:</strong> ${escapeHtml(request.mobile)}</p>
                    <p><strong>Status:</strong> <span class="status-badge" id="status-${request.id}">${escapeHtml(request.status)}</span></p>
                    <p class="meta">Submitted on: ${date}</p>
                    <div class="request-actions">
                        <select id="status-select-${request.id}" class="status-select">
                            <option value="New" ${request.status === 'New' ? 'selected' : ''}>New</option>
                            <option value="Called" ${request.status === 'Called' ? 'selected' : ''}>Called</option>
                            <option value="Confirmed" ${request.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                            <option value="Cancelled" ${request.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                        <button class="update-status-btn" data-id="${request.id}">Update Status</button>
                        <input type="text" id="notes-input-${request.id}" placeholder="Add a note..." value="${escapeHtml(request.notes || '')}">
                        <button class="update-notes-btn" data-id="${request.id}">Save Note</button>
                        <button class="delete-btn" data-id="${request.id}">Delete</button>
                    </div>
                </div>
            `;
        }

        function attachCardEventListeners() {
            document.querySelectorAll('.update-status-btn').forEach(btn => {
                btn.addEventListener('click', async (event) => {
                    const id = event.target.dataset.id;
                    const select = document.getElementById(`status-select-${id}`);
                    const newStatus = select.value;
                    await updateRequest(id, { status: newStatus });
                });
            });

            document.querySelectorAll('.update-notes-btn').forEach(btn => {
                btn.addEventListener('click', async (event) => {
                    const id = event.target.dataset.id;
                    const input = document.getElementById(`notes-input-${id}`);
                    const newNotes = input.value;
                    await updateRequest(id, { notes: newNotes });
                });
            });

            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (event) => {
                    const id = event.target.dataset.id;
                    if (confirm('Are you sure you want to delete this request? This cannot be undone.')) {
                        await deleteRequest(id);
                    }
                });
            });
        }

        async function updateRequest(id, updates) {
            showAdminMessage('Updating...', '');
            const { data, error } = await supabase
                .from('appointment_requests')
                .update(updates)
                .eq('id', id);

            if (error) {
                console.error('Update error:', error);
                showAdminMessage('Failed to update request.', 'error');
            } else {
                showAdminMessage('Request updated successfully!', 'success');
                // Refresh the list to show updated data
                loadRequests();
            }
        }

        async function deleteRequest(id) {
            showAdminMessage('Deleting...', '');
            const { error } = await supabase
                .from('appointment_requests')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Delete error:', error);
                showAdminMessage('Failed to delete request.', 'error');
            } else {
                showAdminMessage('Request deleted successfully!', 'success');
                loadRequests(); // Refresh
            }
        }

        function showAdminMessage(text, type) {
            if (adminMessageBox) {
                adminMessageBox.textContent = text;
                adminMessageBox.className = 'message-box'; // Reset classes
                if (type) {
                    adminMessageBox.classList.add(type);
                    adminMessageBox.style.display = 'block';
                } else {
                    adminMessageBox.style.display = 'none';
                }
                // Hide success messages after a few seconds
                if (type === 'success') {
                    setTimeout(() => {
                        adminMessageBox.style.display = 'none';
                    }, 3000);
                }
            }
        }
    }

    // --- Helper Functions ---
    function showMessage(message, type, element) {
        if (!element) return;
        element.textContent = message;
        element.className = 'message-box'; // Reset classes
        element.classList.add(type);
        element.style.display = 'block';
    }

    // Simple function to prevent XSS
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

})();
