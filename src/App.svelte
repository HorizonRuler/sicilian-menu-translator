<script>
  // State variables
  let imageFile = null;
  let imagePreview = null;
  let isProcessing = false;
  let matchedTerms = [];
  let expandedTerms = {};
  let error = null;

  // Handle image upload from file input
  async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset state
    imageFile = file;
    error = null;
    matchedTerms = [];
    expandedTerms = {};

    // Wait for preview to load first
    try {
      imagePreview = await fileToBase64(file);
    } catch (err) {
      error = 'Failed to read image file. Please try another file.';
      imageFile = null;
      return;
    }

    // Then process with Claude vision
    await processImage(file);
  }

  // Process image by calling our backend API
  async function processImage(file) {
    isProcessing = true;
    error = null;

    try {
      // Validate file type
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validImageTypes.includes(file.type)) {
        error = 'Please upload a valid image file (JPEG, PNG, GIF, or WebP).';
        isProcessing = false;
        return;
      }

      // Convert file to base64
      const base64Image = await fileToBase64(file);
      const base64Data = base64Image.split(',')[1]; // Remove data:image/jpeg;base64, prefix

      // Call our backend API (no CORS issues!)
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: base64Data,
          mediaType: file.type
        })
      });

      const data = await response.json();

      if (!response.ok) {
        error = data.error || 'Failed to analyze image. Please try again.';
        isProcessing = false;
        return;
      }

      // Extract response from backend
      const message = data.response;

      // Validate response structure
      if (!message.content || !message.content[0] || !message.content[0].text) {
        error = 'Unexpected response format from API.';
        isProcessing = false;
        return;
      }

      const responseText = message.content[0].text;
      console.log('Claude response:', responseText);

      // Extract and parse JSON safely
      try {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // Validate structure
          if (Array.isArray(parsed) && parsed.every(item => item.name && item.definition)) {
            matchedTerms = parsed;
          } else {
            console.warn('Invalid dish structure in response:', parsed);
            matchedTerms = [];
          }
        } else {
          matchedTerms = [];
        }
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr);
        console.error('Raw response:', responseText);
        matchedTerms = [];
        error = 'Failed to parse response. Please try again.';
      }

    } catch (err) {
      console.error('API Error:', err);
      error = err.message || 'Failed to analyze image. Please try again.';
    } finally {
      isProcessing = false;
    }
  }

  // Helper function to convert File to base64
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }


  // Toggle term expansion
  function toggleTerm(termName) {
    expandedTerms[termName] = !expandedTerms[termName];
    expandedTerms = expandedTerms; // Trigger reactivity
  }

  // Reset to initial state
  function reset() {
    imageFile = null;
    imagePreview = null;
    isProcessing = false;
    matchedTerms = [];
    expandedTerms = {};
    error = null;
  }
</script>

<main>
  <header>
    <h1>Sicilian Menu Translator</h1>
    <p>Upload a menu photo to identify Sicilian dishes</p>
  </header>

  <div class="container">
    {#if !imagePreview}
      <!-- Initial upload state -->
      <div class="upload-section">
        <label for="imageInput" class="upload-button">
          Analyze Menu Photo
        </label>
        <input
          id="imageInput"
          type="file"
          accept="image/*"
          capture="environment"
          on:change={handleImageUpload}
        />
      </div>
    {:else}
      <!-- Image preview and results -->
      <div class="results-section">
        <div class="image-preview">
          <img src={imagePreview} alt="Menu preview" />
        </div>

        {#if isProcessing}
          <div class="processing">
            <div class="spinner"></div>
            <p>Analyzing menu with AI...</p>
            <p class="hint">This may take a few seconds</p>
          </div>
        {:else if error}
          <div class="error">
            <p>{error}</p>
            <button on:click={reset}>Try Another Photo</button>
          </div>
        {:else if matchedTerms.length > 0}
          <div class="matches">
            <h2>Found {matchedTerms.length} Sicilian {matchedTerms.length === 1 ? 'dish' : 'dishes'}:</h2>
            <div class="term-list">
              {#each matchedTerms as term}
                <div class="term-card">
                  <button 
                    class="term-header"
                    on:click={() => toggleTerm(term.name)}
                  >
                    <span class="term-name">{term.name}</span>
                    <span class="toggle-icon">
                      {expandedTerms[term.name] ? '−' : '+'}
                    </span>
                  </button>
                  {#if expandedTerms[term.name]}
                    <div class="term-definition">
                      {term.definition}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div class="no-matches">
            <p>No Sicilian dishes found in this image.</p>
            <p class="hint">Make sure the photo is clear and includes Sicilian menu items.</p>
          </div>
        {/if}

        {#if !isProcessing}
          <button class="reset-button" on:click={reset}>
            Analyze Another Photo
          </button>
        {/if}
      </div>
    {/if}
  </div>

  <footer>
    <p>HorizonRuler 2025</p>
  </footer>
</main>

<style>
  /* Global styles */
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: #f9fafb;
    min-height: 100vh;
  }

  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    min-height: 100vh;
  }

  /* Header */
  header {
    text-align: center;
    color: #111827;
    margin-bottom: 30px;
  }

  h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  header p {
    margin: 10px 0 0 0;
    opacity: 0.9;
    font-size: 1rem;
  }

  /* Container */
  .container {
    background: white;
    border-radius: 16px;
    padding: 30px;
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.04);
    min-height: 300px;
  }

  /* Upload section */
  .upload-section {
    text-align: center;
    padding: 60px 20px;
  }

  #imageInput {
    display: none;
  }

  .upload-button {
    display: inline-block;
    background: #2563eb;
    color: white;
    padding: 16px 32px;
    font-size: 1.1rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .upload-button:hover {
    background: #1d4ed8;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
  }

  .upload-button:active {
    transform: scale(0.98);
  }

  /* Results section */
  .results-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .image-preview {
    text-align: center;
  }

  .image-preview img {
    max-width: 100%;
    max-height: 400px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.03);
  }

  /* Processing state */
  .processing {
    text-align: center;
    padding: 40px 20px;
    max-width: 500px;
    margin: 0 auto;
  }

  .spinner {
    width: 50px;
    height: 50px;
    margin: 0 auto 20px;
    border: 4px solid #e5e7eb;
    border-top: 4px solid #2563eb;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .processing p {
    margin: 12px 0;
    color: #374151;
    font-weight: 500;
  }

  .hint {
    font-size: 0.9rem;
    color: #6b7280;
    font-weight: 400;
  }

  /* Error state */
  .error {
    text-align: center;
    padding: 40px 20px;
    max-width: 500px;
    margin: 0 auto;
  }

  .error p {
    color: #ef4444;
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 20px;
  }

  .error button {
    margin-top: 16px;
    padding: 12px 24px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .error button:hover {
    background: #dc2626;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
  }

  .error button:active {
    transform: scale(0.98);
  }

  /* Matches section */
  .matches {
    max-width: 600px;
    margin: 0 auto;
  }

  .matches h2 {
    margin: 0 0 24px 0;
    font-size: 1.4rem;
    font-weight: 600;
    color: #111827;
    text-align: center;
    letter-spacing: -0.01em;
  }

  .term-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 600px;
    margin: 0 auto;
  }

  .term-card {
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    overflow: hidden;
    background: white;
    transition: box-shadow 0.3s ease, transform 0.3s ease, border-color 0.3s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  }

  .term-card:hover {
    border-color: #2563eb;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04);
    transform: translateY(-4px);
  }

  .term-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    background: white;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    text-align: left;
    transition: background 0.2s;
  }

  .term-header:hover {
    background: #f8f9fa;
  }

  .term-name {
    font-weight: 600;
    color: #111827;
    font-size: 1.15rem;
    letter-spacing: -0.01em;
  }

  .toggle-icon {
    font-size: 1.5rem;
    color: #2563eb;
    font-weight: 300;
    min-width: 24px;
    text-align: center;
  }

  .term-definition {
    padding: 20px 24px 24px 24px;
    background: #f8f9fa;
    border-top: 1px solid #e5e7eb;
    color: #4b5563;
    line-height: 1.8;
    font-size: 0.975rem;
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* No matches state */
  .no-matches {
    text-align: center;
    padding: 40px 20px;
    max-width: 500px;
    margin: 0 auto;
  }

  .no-matches p {
    margin: 12px 0;
    color: #6b7280;
  }

  .no-matches p:first-child {
    font-size: 1.2rem;
    font-weight: 600;
    color: #374151;
  }

  /* Reset button */
  .reset-button {
    width: 100%;
    max-width: 300px;
    margin: 0 auto;
    display: block;
    padding: 14px 24px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .reset-button:hover {
    background: #1d4ed8;
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.12), 0 3px 6px rgba(0, 0, 0, 0.08);
  }

  .reset-button:active {
    transform: scale(0.98);
  }

  /* Footer */
  footer {
    text-align: center;
    margin-top: 30px;
    color: #6b7280;
    font-size: 0.9rem;
  }

  /* Mobile responsive */
  @media (max-width: 600px) {
    main {
      padding: 15px;
    }

    .container {
      padding: 20px;
    }

    h1 {
      font-size: 1.6rem;
    }

    .upload-button {
      padding: 14px 28px;
      font-size: 1rem;
    }

    .image-preview img {
      max-height: 300px;
    }

    .term-name {
      font-size: 1rem;
    }
  }
</style>
