// app.js
(function() {
    // --- Initialization ---
    if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || window.SUPABASE_CONFIG.url.includes("PASTE_YOUR")) {
        console.error("SUPABASE_CONFIG is missing or not configured.");
        document.body.innerHTML = '<div style="color:red; text-align:center; margin-top:50px;"><h1>Configuration Error</h1><p>Supabase URL and Anon Key are not set in config.js.</p></div>';
        return;
    }

    const supabase = window.supabase.createClient(
        window.SUPABASE_CONFIG.url,
        window.SUPABASE_CONFIG.anonKey
    );

    const isAdminPage = window.location.pathname.includes('admin.html');
    const isPublicPage = !isAdminPage;

    // --- Public Page Logic ---
    if (isPublicPage) {
        const form = document.getElementById('appointment-form');
        const submitBtn = document.getElementById('submit-btn');
        const messageBox = document.getElementById('message-box');

        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const name = document.getElementById('name').value.trim();
                const mobile = document.getElementById('mobile').value.trim();

                if (!name || !mobile) {
                    showMessage('Please fill in both fields.', 'error', messageBox);
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.textContent = 'Submitting...';
                messageBox.style.display = 'none';

                const { error } = await supabase
                    .from('appointment_requests')
                    .insert([{ name: name, mobile: mobile }]);

                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Request';

                if (error) {
                    console.error('Submit error:', error);
                    showMessage('Submission failed. Please try again.', 'error', messageBox);
                } else {
                    showMessage('Thank you! We received your request. Our team will call you soon.', 'success', messageBox);
                    form.reset();
                }
            });
        }
    }

    // --- Admin Page Logic ---
    if (isAdminPage) {
        const loginSection = document.getElementById('login-section');
        const dashboardSection = document.getElementById('dashboard-section');
        const loginForm = document.getElementById('login-form');
        const loginError = document.getElementById('login-error');
        const logoutBtn = document.getElementById('logout-btn');
        const adminMessageBox = document.getElementById('admin-message-box');

        // Check session on load
        checkSession();

        // Login form
        if (loginForm) {
            loginForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                
                const email = document.getElementById('email').value.trim();
                const password = document.getElementById('password').value;
                const loginBtn = document.getElementById('login-btn');
                
                console.log('Attempting login with:', email);
                
                loginBtn.disabled = true;
                loginBtn.textContent = 'Logging in...';
                loginError.style.display = 'none';

                // Sign in
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                console.log('Login response:', { data, error });

                if (error) {
                    console.error('Login error:', error);
                    loginError.textContent = 'Invalid email or password.';
                    loginError.style.display = 'block';
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Log In';
                    return;
                }

                if (data && data.user) {
                    console.log('User logged in, checking admin status...');
                    
                    // Check if user is in admins table
                    const { data: adminData, error: adminError } = await supabase
                        .from('admins')
                        .select('user_id')
                        .eq('user_id', data.user.id)
                        .single();

                    console.log('Admin check:', { adminData, adminError });

                    if (adminError || !adminData) {
                        console.error('Not an admin:', adminError);
                        await supabase.auth.signOut();
                        loginError.textContent = 'Access denied. You are not an authorized admin.';
                        loginError.style.display = 'block';
                        loginBtn.disabled = false;
                        loginBtn.textContent = 'Log In';
                    } else {
                        console.log('Admin verified, showing dashboard');
                        showDashboard();
                    }
                }
            });
        }

        // Logout
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await supabase.auth.signOut();
                showLogin();
            });
        }

        async function checkSession() {
            const { data: { session } } = await supabase.auth.getSession();
            console.log('Session check:', session);
            
            if (session && session.user) {
                // Verify admin status
                const { data, error } = await supabase
                    .from('admins')
                    .select('user_id')
                    .eq('user_id', session.user.id)
                    .single();

                if (!error && data) {
                    showDashboard();
                } else {
                    await supabase.auth.signOut();
                    showLogin();
                }
            } else {
                showLogin();
            }
        }

        function showLogin() {
            document.getElementById('login-section').style.display = 'block';
            document.getElementById('dashboard-section').style.display = 'none';
        }

        function showDashboard() {
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('dashboard-section').style.display = 'block';
            loadRequests();
        }

        async function loadRequests() {
            const container = document.getElementById('requests-container');
            container.innerHTML = '<p>Loading requests...</p>';

            const { data: requests, error } = await supabase
                .from('appointment_requests')
                .select('*')
                .order('created_at', { ascending: false });

            console.log('Requests loaded:', { requests, error });

            if (error) {
                console.error('Load error:', error);
                container.innerHTML = '<p class="error-message">Failed to load requests.</p>';
                return;
            }

            if (!requests || requests.length === 0) {
                container.innerHTML = '<p>No appointment requests found.</p>';
                return;
            }

            container.innerHTML = requests.map(request => `
                <div class="request-card" data-id="${request.id}">
                    <h3>${escapeHtml(request.name)}</h3>
                    <p><strong>Mobile:</strong> ${escapeHtml(request.mobile)}</p>
                    <p><strong>Status:</strong> ${escapeHtml(request.status)}</p>
                    <p class="meta">Submitted: ${new Date(request.created_at).toLocaleString()}</p>
                    <p><strong>Notes:</strong> ${escapeHtml(request.notes || 'None')}</p>
                    <div class="request-actions">
                        <select id="status-${request.id}">
                            <option value="New" ${request.status === 'New' ? 'selected' : ''}>New</option>
                            <option value="Called" ${request.status === 'Called' ? 'selected' : ''}>Called</option>
                            <option value="Confirmed" ${request.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                            <option value="Cancelled" ${request.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                        <button onclick="window.updateStatus('${request.id}')">Update Status</button>
                        <input type="text" id="notes-${request.id}" placeholder="Add note..." value="${escapeHtml(request.notes || '')}">
                        <button onclick="window.updateNotes('${request.id}')">Save Note</button>
                        <button class="delete-btn" onclick="window.deleteRequest('${request.id}')">Delete</button>
                    </div>
                </div>
            `).join('');
        }

        // Make functions globally accessible
        window.updateStatus = async function(id) {
            const select = document.getElementById(`status-${id}`);
            const newStatus = select.value;
            const { error } = await supabase
                .from('appointment_requests')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) {
                alert('Failed to update status');
            } else {
                loadRequests();
            }
        };

        window.updateNotes = async function(id) {
            const input = document.getElementById(`notes-${id}`);
            const newNotes = input.value;
            const { error } = await supabase
                .from('appointment_requests')
                .update({ notes: newNotes })
                .eq('id', id);

            if (error) {
                alert('Failed to update notes');
            } else {
                loadRequests();
            }
        };

        window.deleteRequest = async function(id) {
            if (confirm('Are you sure you want to delete this request?')) {
                const { error } = await supabase
                    .from('appointment_requests')
                    .delete()
                    .eq('id', id);

                if (error) {
                    alert('Failed to delete request');
                } else {
                    loadRequests();
                }
            }
        };
    }

    function showMessage(message, type, element) {
        if (!element) return;
        element.textContent = message;
        element.className = 'message-box ' + type;
        element.style.display = 'block';
    }

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
