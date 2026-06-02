// API Base Configuration
const API_BASE = "/api";

// Client State
let state = {
    currentSubreddit: "All",
    currentSort: "hot",
    searchQuery: "",
    posts: [],
    subreddits: [],
    currentUser: "u/dev_ops_wizard",
    theme: "dark"
};

// ==========================================================================
// Initialization & Event Listeners
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initApp();
    setupEventListeners();
});

// Initialize theme from localStorage or default to dark
function initTheme() {
    const savedTheme = localStorage.getItem("devops_theme") || "dark";
    state.theme = savedTheme;
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const btn = document.getElementById("theme-toggle-btn");
    if (!btn) return;
    // Lucide updates automatically on load, but we can toggle icons manually or via class
}

// Initial API fetches and page render
async function initApp() {
    // Render initial empty state / loaders
    renderSubredditsList([]);
    
    // Perform parallel fetches
    await Promise.all([
        fetchSubreddits(),
        fetchPosts()
    ]);
}

// Global Event Handlers Setup
function setupEventListeners() {
    // Logo / Home button
    document.getElementById("btn-logo-home").addEventListener("click", () => {
        state.currentSubreddit = "All";
        state.searchQuery = "";
        document.getElementById("global-search").value = "";
        document.getElementById("search-clear-btn").classList.add("hidden");
        document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
        const allEl = document.querySelector('[data-sub="All"]');
        if (allEl) allEl.classList.add("active");
        showFeedView();
        fetchPosts();
    });

    // Theme Toggle
    document.getElementById("theme-toggle-btn").addEventListener("click", () => {
        state.theme = state.theme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", state.theme);
        localStorage.setItem("devops_theme", state.theme);
    });

    // User Profile Selector
    document.getElementById("user-selector").addEventListener("change", (e) => {
        state.currentUser = e.target.value;
    });

    // Search bar input & clear
    const searchInput = document.getElementById("global-search");
    const searchClear = document.getElementById("search-clear-btn");
    
    searchInput.addEventListener("input", (e) => {
        state.searchQuery = e.target.value.trim();
        if (state.searchQuery.length > 0) {
            searchClear.classList.remove("hidden");
        } else {
            searchClear.classList.add("hidden");
        }
        
        // Debounce search slightly
        clearTimeout(state.searchTimeout);
        state.searchTimeout = setTimeout(() => {
            fetchPosts();
        }, 400);
    });

    searchClear.addEventListener("click", () => {
        searchInput.value = "";
        state.searchQuery = "";
        searchClear.classList.add("hidden");
        fetchPosts();
    });

    // Sort buttons filter
    const filterBtns = document.querySelectorAll(".feed-filters .filter-btn");
    filterBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const btnEl = e.currentTarget;
            filterBtns.forEach(b => b.classList.remove("active"));
            btnEl.classList.add("active");
            state.currentSort = btnEl.getAttribute("data-sort");
            fetchPosts();
        });
    });

    // Modal Control: Run Task Open & Close
    const runModal = document.getElementById("run-task-modal");
    const openBtn = document.getElementById("btn-create-post");
    const closeBtn = document.getElementById("modal-close-btn");
    const cancelBtn = document.getElementById("modal-cancel-btn");

    const openModal = () => {
        runModal.classList.remove("hidden");
        document.getElementById("run-task-form").classList.remove("hidden");
        document.getElementById("agent-visualizer").classList.add("hidden");
        document.getElementById("task-prompt").value = "";
        document.getElementById("task-prompt").focus();
    };

    const closeModal = () => {
        if (state.isRunningTask) return; // Prevent close during run
        runModal.classList.add("hidden");
    };

    openBtn.addEventListener("click", openModal);
    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);
    
    // Close modal if clicking overlay
    runModal.addEventListener("click", (e) => {
        if (e.target === runModal) {
            closeModal();
        }
    });

    // Quick Prompts list click handler
    document.querySelectorAll(".quick-prompt-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            openModal();
            document.getElementById("task-prompt").value = e.target.textContent;
        });
    });

    // Run Task Submit Form
    document.getElementById("run-task-form").addEventListener("submit", handleRunTaskSubmit);

    // Back to feed navigation
    document.getElementById("btn-back-to-feed").addEventListener("click", showFeedView);
}

// ==========================================================================
// Views Toggler
// ==========================================================================

function showFeedView() {
    document.getElementById("feed-view-container").classList.remove("hidden");
    document.getElementById("post-details-container").classList.add("hidden");
    document.getElementById("feed-title").textContent = `r/${state.currentSubreddit}`;
}

function showDetailsView() {
    document.getElementById("feed-view-container").classList.add("hidden");
    document.getElementById("post-details-container").classList.remove("hidden");
}

// ==========================================================================
// API Operations: Fetching & Data Loading
// ==========================================================================

// Fetch unique subreddits list
async function fetchSubreddits() {
    try {
        const response = await fetch(`${API_BASE}/subreddits`);
        if (!response.ok) throw new Error("Subreddits retrieval error");
        state.subreddits = await response.json();
        renderSubredditsList(state.subreddits);
        
        // Update sidebar widgets stats
        document.getElementById("stats-total-subs").textContent = state.subreddits.length;
    } catch (err) {
        console.error("Failed to load subreddits list:", err);
        // Load some defaults in case of failure
        renderSubredditsList(["All", "FastAPI", "GitHub", "StackOverflow", "Docker", "Python"]);
    }
}

// Fetch posts feed (supports sorting, search, subreddit filter)
async function fetchPosts() {
    const listContainer = document.getElementById("post-cards-list");
    listContainer.innerHTML = `
        <div class="loading-spinner-container">
            <div class="spinner"></div>
            <p>Retrieving posts...</p>
        </div>
    `;

    try {
        let url = `${API_BASE}/posts?sort=${state.currentSort}`;
        if (state.currentSubreddit && state.currentSubreddit !== "All") {
            url += `&subreddit=${encodeURIComponent(state.currentSubreddit)}`;
        }
        if (state.searchQuery) {
            url += `&query=${encodeURIComponent(state.searchQuery)}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error("Posts retrieval error");
        state.posts = await response.json();
        
        renderPostsFeed(state.posts);
        
        // Update sidebar stats
        document.getElementById("stats-total-posts").textContent = state.posts.length;
        document.getElementById("status-backend").className = "status-dot online";
    } catch (err) {
        console.error("Failed to load posts:", err);
        listContainer.innerHTML = `
            <div class="no-posts-card">
                <i data-lucide="alert-circle"></i>
                <h3>Server connection failed</h3>
                <p>Could not fetch items from FastAPI service. Make sure backend runs on localhost:8000.</p>
                <button class="btn btn-secondary" onclick="fetchPosts()" style="margin-top:12px;">Retry Connection</button>
            </div>
        `;
        lucide.createIcons();
        document.getElementById("status-backend").className = "status-dot offline";
    }
}

// ==========================================================================
// Rendering Elements
// ==========================================================================

// Render subreddits navigation in left sidebar
function renderSubredditsList(list) {
    const container = document.getElementById("subreddit-list");
    container.innerHTML = "";
    
    list.forEach(subName => {
        if (subName.toLowerCase() === "all") return; // Rendered statically at top
        
        const li = document.createElement("li");
        li.className = `nav-item ${state.currentSubreddit === subName ? 'active' : ''}`;
        li.setAttribute("data-sub", subName);
        li.innerHTML = `
            <span class="subreddit-tag-circle">${subName[0].toUpperCase()}</span>
            <span>r/${subName}</span>
        `;
        
        li.addEventListener("click", () => {
            state.currentSubreddit = subName;
            state.searchQuery = "";
            document.getElementById("global-search").value = "";
            
            // Toggle active classes
            document.querySelectorAll(".sidebar-left .nav-item").forEach(item => item.classList.remove("active"));
            li.classList.add("active");
            
            showFeedView();
            fetchPosts();
        });
        
        container.appendChild(li);
    });
}

// Render posts feed list in center panel
function renderPostsFeed(posts) {
    const container = document.getElementById("post-cards-list");
    container.innerHTML = "";
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="no-posts-card">
                <i data-lucide="compass"></i>
                <h3>No posts found</h3>
                <p>There are no queries matches in r/${state.currentSubreddit} right now. Click "Run Agent Task" to trigger a new run!</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    posts.forEach(post => {
        const card = document.createElement("div");
        card.className = "post-card";
        
        // Count total steps from planner
        const stepsCount = post.plan?.steps?.length || 0;
        const relativeTime = getRelativeTime(post.created_at);
        const score = post.upvotes - post.downvotes;
        
        // Check for active local votes
        const isUpvoted = localStorage.getItem(`post_up_${post.id}`) === "true";
        const isDownvoted = localStorage.getItem(`post_down_${post.id}`) === "true";
        
        card.innerHTML = `
            <div class="post-voting" onclick="event.stopPropagation()">
                <button class="vote-arrow up ${isUpvoted ? 'active' : ''}" data-id="${post.id}" title="Upvote">
                    <i data-lucide="arrow-up"></i>
                </button>
                <span class="vote-count">${score}</span>
                <button class="vote-arrow down ${isDownvoted ? 'active' : ''}" data-id="${post.id}" title="Downvote">
                    <i data-lucide="arrow-down"></i>
                </button>
            </div>
            
            <div class="post-main">
                <div class="post-meta">
                    <span class="post-subreddit-tag">r/${post.subreddit}</span>
                    <span class="post-bullet">•</span>
                    <span>Posted by ${post.author}</span>
                    <span>${relativeTime}</span>
                </div>
                
                <h2 class="post-card-title">${escapeHTML(post.task)}</h2>
                
                <p class="post-card-summary">${post.final_result ? stripMarkdown(post.final_result) : 'Executing multi-agent processing...'}</p>
                
                <div class="post-plan-preview">
                    ${post.plan?.steps ? post.plan.steps.map(step => `
                        <span class="plan-step-badge">
                            <i data-lucide="${step.tool === 'github_search' ? 'github' : 'help-circle'}"></i>
                            ${escapeHTML(step.description)}
                        </span>
                    `).join('') : ''}
                </div>
                
                <div class="post-actions">
                    <button class="post-action-btn">
                        <i data-lucide="message-square"></i>
                        <span>${post.comment_count || 0} Comments</span>
                    </button>
                    <button class="post-action-btn share-btn" data-id="${post.id}">
                        <i data-lucide="share-2"></i>
                        <span>Share</span>
                    </button>
                </div>
            </div>
        `;
        
        // Open details view when card is clicked
        card.addEventListener("click", () => {
            loadPostDetails(post.id);
        });
        
        // Setup vote event listeners
        const upBtn = card.querySelector(".vote-arrow.up");
        const downBtn = card.querySelector(".vote-arrow.down");
        const scoreVal = card.querySelector(".vote-count");
        
        upBtn.addEventListener("click", () => handleVote(post.id, "up", upBtn, downBtn, scoreVal));
        downBtn.addEventListener("click", () => handleVote(post.id, "down", upBtn, downBtn, scoreVal));
        
        // Setup share listener
        card.querySelector(".share-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(`${window.location.origin}/#post-${post.id}`);
            alert("Post link copied to clipboard!");
        });

        container.appendChild(card);
    });
    
    lucide.createIcons();
}

// Load expanded post details from api and render
async function loadPostDetails(postId) {
    const detailsContainer = document.getElementById("post-details-content");
    detailsContainer.innerHTML = `
        <div class="loading-spinner-container">
            <div class="spinner"></div>
            <p>Loading agent report details...</p>
        </div>
    `;
    showDetailsView();

    try {
        const response = await fetch(`${API_BASE}/posts/${postId}`);
        if (!response.ok) throw new Error("Failed to load post details");
        const post = await response.json();
        
        renderPostDetails(post);
        document.getElementById("status-backend").className = "status-dot online";
    } catch (err) {
        console.error("Failed to fetch post details:", err);
        detailsContainer.innerHTML = `
            <div class="no-posts-card">
                <i data-lucide="alert-triangle"></i>
                <h3>Error Loading Details</h3>
                <p>Could not reach the server to download full agent execution logs.</p>
                <button class="btn btn-secondary" onclick="loadPostDetails(${postId})" style="margin-top:12px;">Retry</button>
            </div>
        `;
        lucide.createIcons();
    }
}

// Render expanded post details card, flowchart and comments
function renderPostDetails(post) {
    const container = document.getElementById("post-details-content");
    
    const relativeTime = getRelativeTime(post.created_at);
    const score = post.upvotes - post.downvotes;
    
    // Check local votes
    const isUpvoted = localStorage.getItem(`post_up_${post.id}`) === "true";
    const isDownvoted = localStorage.getItem(`post_down_${post.id}`) === "true";

    // Setup HTML structure
    container.innerHTML = `
        <article class="post-detail-main-card">
            
            <div class="post-detail-header-panel">
                <div class="post-voting">
                    <button class="vote-arrow up ${isUpvoted ? 'active' : ''}" id="detail-vote-up" title="Upvote">
                        <i data-lucide="arrow-up"></i>
                    </button>
                    <span class="vote-count" id="detail-vote-count">${score}</span>
                    <button class="vote-arrow down ${isDownvoted ? 'active' : ''}" id="detail-vote-down" title="Downvote">
                        <i data-lucide="arrow-down"></i>
                    </button>
                </div>
                
                <div class="post-main">
                    <div class="post-meta">
                        <span class="post-subreddit-tag">r/${post.subreddit}</span>
                        <span class="post-bullet">•</span>
                        <span>Posted by ${post.author}</span>
                        <span>${relativeTime}</span>
                    </div>
                    <h1 class="post-card-title" style="font-size: 22px; margin-top:4px;">${escapeHTML(post.task)}</h1>
                </div>
            </div>
            
            <div class="post-detail-body">
                <!-- Section 1: Verifier Final Markdown Report -->
                <div class="detail-section-title">
                    <i data-lucide="shield-check"></i>
                    <span>Verified Synthesis Answer</span>
                </div>
                <div class="verifier-markdown-output" id="markdown-renderer">
                    ${marked.parse(post.final_result || "No answer generated.")}
                </div>
                
                <!-- Section 2: Agent execution step flow -->
                <div class="detail-section-title">
                    <i data-lucide="workflow"></i>
                    <span>Multi-Agent Execution Flow</span>
                </div>
                
                <div class="flow-diagram-container">
                    ${post.execution_results?.steps ? post.execution_results.steps.map((step, idx) => `
                        <div class="flow-step-item">
                            <div class="flow-step-header">
                                <span class="flow-step-number">Step ${idx+1}: ${step.tool === 'github_search' ? 'GitHub Query' : 'StackOverflow Query'}</span>
                                <span class="flow-step-tool-badge">${escapeHTML(step.tool)}</span>
                            </div>
                            <div class="flow-step-desc">${escapeHTML(step.description)}</div>
                            <div class="flow-step-meta" style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">
                                <strong>Query:</strong> <code>${escapeHTML(step.inputs?.query || '')}</code>
                            </div>
                            
                            <button class="flow-step-details-toggle" data-idx="${idx}">
                                <i data-lucide="chevron-down"></i><span>Show raw search outputs</span>
                            </button>
                            
                            <pre class="flow-step-json-content hidden" id="json-step-${idx}"><code>${escapeHTML(JSON.stringify(step.result, null, 2))}</code></pre>
                        </div>
                    `).join('') : '<p style="color:var(--text-muted);">No execution steps recorded.</p>'}
                </div>
            </div>
        </article>
        
        <!-- Section 3: Comments area -->
        <div class="comments-container">
            <h3 style="margin-bottom:16px; font-size:16px;">Comments (${post.comments ? post.comments.length : 0})</h3>
            
            <div class="comment-input-area">
                <label for="new-comment-text">Discuss this execution result:</label>
                <textarea id="new-comment-text" class="comment-textarea" placeholder="What are your thoughts on this AI execution? Leave a comment..." rows="3"></textarea>
                <button class="btn btn-primary" id="btn-submit-comment">Post Comment</button>
            </div>
            
            <div class="comments-list" id="post-comments-list">
                <!-- Render comments tree dynamically -->
            </div>
        </div>
    `;
    
    // Add vote listeners for detail view
    const dUp = document.getElementById("detail-vote-up");
    const dDown = document.getElementById("detail-vote-down");
    const dScore = document.getElementById("detail-vote-count");
    
    dUp.addEventListener("click", () => handleVote(post.id, "up", dUp, dDown, dScore));
    dDown.addEventListener("click", () => handleVote(post.id, "down", dUp, dDown, dScore));

    // Add Toggle click listeners on flow steps
    container.querySelectorAll(".flow-step-details-toggle").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const idx = btn.getAttribute("data-idx");
            const targetEl = document.getElementById(`json-step-${idx}`);
            const icon = btn.querySelector("i");
            const textSpan = btn.querySelector("span");
            
            if (targetEl.classList.contains("hidden")) {
                targetEl.classList.remove("hidden");
                textSpan.textContent = "Hide raw search outputs";
                icon.setAttribute("data-lucide", "chevron-up");
            } else {
                targetEl.classList.add("hidden");
                textSpan.textContent = "Show raw search outputs";
                icon.setAttribute("data-lucide", "chevron-down");
            }
            lucide.createIcons();
        });
    });

    // Render Comments Tree
    renderComments(post.comments || [], post.id);

    // Comment submission button
    document.getElementById("btn-submit-comment").addEventListener("click", () => {
        const text = document.getElementById("new-comment-text").value.trim();
        if (!text) return;
        submitComment(post.id, text, null);
    });

    lucide.createIcons();
}

// Render comments with parent/child structure
function renderComments(commentsList, postId) {
    const listContainer = document.getElementById("post-comments-list");
    listContainer.innerHTML = "";
    
    if (commentsList.length === 0) {
        listContainer.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding: 20px 0;">No comments yet. Be the first to share your thoughts!</p>`;
        return;
    }
    
    // Map comments by id to build nested children dictionary
    const commentsById = {};
    const roots = [];
    
    commentsList.forEach(c => {
        c.replies = [];
        commentsById[c.id] = c;
    });
    
    commentsList.forEach(c => {
        if (c.parent_id && commentsById[c.parent_id]) {
            commentsById[c.parent_id].replies.push(c);
        } else {
            roots.push(c);
        }
    });

    // Recursive helper to render comment cards
    function renderNode(comment, depth = 0) {
        const relativeTime = getRelativeTime(comment.created_at);
        const card = document.createElement("div");
        card.className = "comment-card";
        card.style.marginLeft = `${depth * 8}px`; // Indent replies
        card.innerHTML = `
            <div class="comment-header">
                <span class="comment-author">${escapeHTML(comment.author)}</span>
                <span>${relativeTime}</span>
                <span>•</span>
                <span style="font-weight:600;">★ ${comment.upvotes || 1}</span>
            </div>
            <div class="comment-content">${escapeHTML(comment.content)}</div>
            <div class="comment-actions">
                <button class="comment-reply-btn" data-id="${comment.id}" style="background:none; border:none; cursor:pointer; font-size:11px; font-weight:700; color:var(--text-secondary);">Reply</button>
            </div>
            <div class="comment-reply-form hidden" id="reply-form-${comment.id}">
                <textarea class="comment-textarea" placeholder="Write a reply..." rows="2" style="font-size:12.5px;"></textarea>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-primary reply-submit" data-parent="${comment.id}" style="height:28px; font-size:11px; padding: 0 10px;">Reply</button>
                    <button class="btn btn-secondary reply-cancel" data-parent="${comment.id}" style="height:28px; font-size:11px; padding: 0 10px;">Cancel</button>
                </div>
            </div>
            <div class="comment-children" id="comment-children-${comment.id}"></div>
        `;

        // Toggle Reply Box listener
        const replyBtn = card.querySelector(".comment-reply-btn");
        const replyForm = card.querySelector(`#reply-form-${comment.id}`);
        const replyCancel = card.querySelector(".reply-cancel");
        const replySubmit = card.querySelector(".reply-submit");
        const replyText = card.querySelector("textarea");

        replyBtn.addEventListener("click", () => {
            replyForm.classList.remove("hidden");
            replyText.focus();
        });

        replyCancel.addEventListener("click", () => {
            replyForm.classList.add("hidden");
            replyText.value = "";
        });

        replySubmit.addEventListener("click", () => {
            const text = replyText.value.trim();
            if (!text) return;
            submitComment(postId, text, comment.id);
        });

        // Recursively render child comments
        const childrenContainer = card.querySelector(`#comment-children-${comment.id}`);
        comment.replies.forEach(reply => {
            childrenContainer.appendChild(renderNode(reply, depth + 1));
        });

        return card;
    }

    roots.forEach(root => {
        listContainer.appendChild(renderNode(root, 0));
    });
}

// Submit a new comment or reply
async function submitComment(postId, content, parentId = null) {
    try {
        const response = await fetch(`${API_BASE}/posts/${postId}/comments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content: content,
                author: state.currentUser,
                parent_id: parentId
            })
        });

        if (!response.ok) throw new Error("Comment submission failed");
        
        // Refresh details page
        await loadPostDetails(postId);
        // Refresh feed in background so comments count is accurate
        fetchPosts();
    } catch (err) {
        console.error("Failed to post comment:", err);
        alert("Server failed to save your comment. Check connectivity.");
    }
}

// Handle upvotes and downvotes locally and on the server
async function handleVote(postId, type, upBtn, downBtn, scoreVal) {
    const isUp = type === "up";
    const upKey = `post_up_${postId}`;
    const downKey = `post_down_${postId}`;
    
    const wasUpvoted = localStorage.getItem(upKey) === "true";
    const wasDownvoted = localStorage.getItem(downKey) === "true";

    // Stop if user clicks already active vote (prevents duplicate vote counts)
    if ((isUp && wasUpvoted) || (!isUp && wasDownvoted)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/posts/${postId}/vote`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                vote_type: type
            })
        });

        if (!response.ok) throw new Error("Vote failed");
        const updatedPost = await response.json();
        
        // Update Local Storage
        if (isUp) {
            localStorage.setItem(upKey, "true");
            localStorage.removeItem(downKey);
            upBtn.classList.add("active");
            downBtn.classList.remove("active");
        } else {
            localStorage.setItem(downKey, "true");
            localStorage.removeItem(upKey);
            downBtn.classList.add("active");
            upBtn.classList.remove("active");
        }

        // Update score display
        scoreVal.textContent = updatedPost.upvotes - updatedPost.downvotes;
        
        // Update in-memory state representation
        const match = state.posts.find(p => p.id === postId);
        if (match) {
            match.upvotes = updatedPost.upvotes;
            match.downvotes = updatedPost.downvotes;
        }
    } catch (err) {
        console.error("Failed to cast vote:", err);
    }
}

// ==========================================================================
// Form Submission & Live Agent Visualizer Flow
// ==========================================================================

async function handleRunTaskSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const prompt = document.getElementById("task-prompt").value.trim();
    const subreddit = document.getElementById("task-subreddit").value;
    const isMock = document.getElementById("task-mock").checked;

    if (!prompt) return;

    // Lock UI and show visualizer
    state.isRunningTask = true;
    form.classList.add("hidden");
    const visualizer = document.getElementById("agent-visualizer");
    visualizer.classList.remove("hidden");

    // Initialize visualizer nodes & terminal logs
    resetVisualizerNodes();
    const logsEl = document.getElementById("terminal-logs");
    logsEl.innerHTML = "";
    
    addTerminalLog(logsEl, `[Orchestrator] Starting multi-agent pipeline...`, "info");
    addTerminalLog(logsEl, `[Orchestrator] Task received: "${prompt}"`, "info");
    addTerminalLog(logsEl, `[Orchestrator] Mode: ${isMock ? 'SIMULATION (Mock Mode)' : 'LIVE AGENTS'}`, "warning");

    // Start UI animation timeline (fake-streaming progress visual)
    const animTimeline = runVisualizerAnimation(isMock);

    // Call API in the background
    try {
        const response = await fetch(`${API_BASE}/run-task`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                task: prompt,
                subreddit: subreddit,
                author: state.currentUser,
                mock: isMock
            })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || "Multi-agent execution encountered an error");
        }
        
        const newPost = await response.json();
        
        // Complete the animation timeline successfully
        clearInterval(animTimeline);
        await completeVisualizerAnimation(logsEl, newPost);
        
        // Unlock UI
        state.isRunningTask = false;
        document.getElementById("run-task-modal").classList.add("hidden");
        
        // Refresh feeds
        await Promise.all([
            fetchSubreddits(),
            fetchPosts()
        ]);
        
        // Load details of the newly created post
        loadPostDetails(newPost.id);
        
    } catch (err) {
        console.error("Run task error:", err);
        clearInterval(animTimeline);
        state.isRunningTask = false;
        
        // Show error in visualizer
        addTerminalLog(logsEl, `[CRITICAL] Execution crashed: ${err.message}`, "error");
        
        // Mark active node as failed
        const activeNode = document.querySelector(".agent-node.active");
        if (activeNode) {
            activeNode.style.borderColor = "var(--color-offline)";
            activeNode.querySelector(".agent-status").textContent = "Crashed";
        }
        
        // Re-enable cancel/close actions
        const cancelBtn = document.getElementById("modal-cancel-btn");
        cancelBtn.textContent = "Close";
    }
}

// Reset visualizer nodes layout
function resetVisualizerNodes() {
    const nodes = ["node-planner", "node-executor", "node-verifier"];
    nodes.forEach(id => {
        const el = document.getElementById(id);
        el.className = "agent-node";
        el.style.borderColor = "";
        el.querySelector(".agent-status").textContent = "Waiting...";
    });
    
    document.getElementById("connector-1-2").className = "agent-connector";
    document.getElementById("connector-2-3").className = "agent-connector";
}

// Add a line of text to terminal logs box
function addTerminalLog(logsEl, text, type = "") {
    const line = document.createElement("div");
    line.className = `log-line ${type}`;
    
    // Add timestamp
    const time = new Date().toLocaleTimeString();
    line.innerHTML = `<span style="color:var(--text-muted); font-size:11px;">[${time}]</span> ${escapeHTML(text)}`;
    
    logsEl.appendChild(line);
    logsEl.scrollTop = logsEl.scrollHeight; // Auto-scroll
}

// Simulates live visual progress states over time
function runVisualizerAnimation(isMock) {
    const logsEl = document.getElementById("terminal-logs");
    const nodePlanner = document.getElementById("node-planner");
    const nodeExecutor = document.getElementById("node-executor");
    const nodeVerifier = document.getElementById("node-verifier");
    const conn1 = document.getElementById("connector-1-2");
    const conn2 = document.getElementById("connector-2-3");

    let seconds = 0;
    
    // Set Planner active
    nodePlanner.className = "agent-node active";
    nodePlanner.querySelector(".agent-status").textContent = "Planning...";
    addTerminalLog(logsEl, `[Planner] Activating Planner Agent...`, "info");
    addTerminalLog(logsEl, `[Planner] Generating sub-task JSON plan...`, "spinner-line");

    const timer = setInterval(() => {
        seconds += 1;
        
        if (seconds === 3) {
            // Planner complete -> Executor active
            nodePlanner.className = "agent-node completed";
            nodePlanner.querySelector(".agent-status").textContent = "Completed";
            conn1.className = "agent-connector active";
            
            nodeExecutor.className = "agent-node active";
            nodeExecutor.querySelector(".agent-status").textContent = "Searching...";
            addTerminalLog(logsEl, `[Planner] Sub-tasks structured successfully!`, "success");
            addTerminalLog(logsEl, `[Executor] Activating Executor Agent...`, "info");
            addTerminalLog(logsEl, `[Executor] querying GitHub API repository database...`, "spinner-line");
        }
        else if (seconds === 6) {
            addTerminalLog(logsEl, `[Executor] GitHub fetch complete. Found matching repositories.`, "success");
            addTerminalLog(logsEl, `[Executor] querying StackExchange advanced search API...`, "spinner-line");
        }
        else if (seconds === 9) {
            // Executor complete -> Verifier active
            nodeExecutor.className = "agent-node completed";
            nodeExecutor.querySelector(".agent-status").textContent = "Completed";
            conn2.className = "agent-connector active";
            
            nodeVerifier.className = "agent-node active";
            nodeVerifier.querySelector(".agent-status").textContent = "Synthesizing...";
            addTerminalLog(logsEl, `[Executor] StackOverflow fetch complete. Found 2 relevant threads.`, "success");
            addTerminalLog(logsEl, `[Verifier] Activating Verifier Agent...`, "info");
            addTerminalLog(logsEl, `[Verifier] Synthesizing reports and writing markdown answer...`, "spinner-line");
        }
        else if (seconds >= 12 && isMock) {
            // In mock mode we can loop or finish. Let's wait.
            addTerminalLog(logsEl, `[Verifier] Polishing text layout...`, "spinner-line");
        }
    }, 1000);

    return timer;
}

// Complete the visualization transition
async function completeVisualizerAnimation(logsEl, post) {
    const nodePlanner = document.getElementById("node-planner");
    const nodeExecutor = document.getElementById("node-executor");
    const nodeVerifier = document.getElementById("node-verifier");
    const conn1 = document.getElementById("connector-1-2");
    const conn2 = document.getElementById("connector-2-3");

    // Force-complete all nodes
    nodePlanner.className = "agent-node completed";
    nodePlanner.querySelector(".agent-status").textContent = "Completed";
    conn1.className = "agent-connector completed";
    
    nodeExecutor.className = "agent-node completed";
    nodeExecutor.querySelector(".agent-status").textContent = "Completed";
    conn2.className = "agent-connector completed";
    
    nodeVerifier.className = "agent-node completed";
    nodeVerifier.querySelector(".agent-status").textContent = "Completed";
    
    addTerminalLog(logsEl, `[Verifier] Synthesis completed. Answer compiled successfully!`, "success");
    addTerminalLog(logsEl, `[Orchestrator] Multi-agent task execution finished. Saving report.`, "success");
    
    // Mini delay for user to appreciate completion
    await new Promise(resolve => setTimeout(resolve, 800));
}

// ==========================================================================
// Formatting Helpers
// ==========================================================================

// Helper to escape HTML tags
function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

// Strip markdown tags to show plain text in cards feed summary
function stripMarkdown(md) {
    if (!md) return "";
    let plain = md
        .replace(/#+\s+/g, "") // Headings
        .replace(/\*\*|__/g, "") // Bold
        .replace(/\*|_/g, "") // Italic
        .replace(/`[^`]+`/g, "") // Inline Code
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // Links
        .replace(/>\s*/g, "") // Blockquotes
        .replace(/```[\s\S]*?```/g, ""); // Code blocks
    return escapeHTML(plain.substring(0, 200) + (plain.length > 200 ? "..." : ""));
}

// Generate human-friendly relative time (e.g. "2 hours ago")
function getRelativeTime(dateString) {
    const date = new Date(dateString + 'Z'); // Parse as UTC timezone
    const now = new Date();
    
    // Handle local timestamp shifts if date is parsed incorrectly
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays}d ago`;
}
