# Chrome Web Store Submission Checklist

## Before You Submit

### ✅ Pre-Submission Requirements

**Developer Account:**
- [ ] Chrome Web Store Developer account created
- [ ] $5 registration fee paid
- [ ] Identity verification completed

**Extension Package:**
- [ ] Extension tested and working properly
- [ ] All files properly organized in extension folder
- [ ] ZIP file created with required files only
- [ ] File size under 20MB

### ✅ Required Files & Assets

**Manifest & Code:**
- [ ] manifest.json with correct version and permissions
- [ ] All JavaScript files (background.js, popup.js, content-script.js)
- [ ] HTML files (popup.html)
- [ ] CSS files (popup.css)
- [ ] Icons folder with all required sizes

**Icons Required:**
- [ ] 16x16 pixel icon (for toolbar)
- [ ] 48x48 pixel icon (for extensions page)
- [ ] 128x128 pixel icon (for Chrome Web Store)

**Screenshots (Required):**
- [ ] At least 1 screenshot (1280x800 or 640x400 pixels)
- [ ] Up to 5 screenshots showing key features
- [ ] High-quality, clear images showing extension functionality

**Optional Promotional Images:**
- [ ] Small tile: 440x280 pixels
- [ ] Large tile: 920x680 pixels
- [ ] Marquee: 1400x560 pixels

### ✅ Content & Documentation

**Store Listing Content:**
- [ ] Extension name (matches manifest.json)
- [ ] Short description (132 characters max)
- [ ] Detailed description (copy from CHROME_STORE_CONTENT.md)
- [ ] Category selected (Productivity)
- [ ] Language selected (English)

**Privacy & Legal:**
- [ ] Privacy policy (copy from CHROME_STORE_CONTENT.md)
- [ ] Hosted privacy policy URL (if required)
- [ ] Permission justifications prepared
- [ ] Terms of service ready

**Support Information:**
- [ ] Support email address
- [ ] Website URL
- [ ] Support/FAQ page URL

### ✅ Technical Verification

**Manifest.json Check:**
- [ ] Manifest version 3
- [ ] Correct permissions listed
- [ ] Valid host permissions
- [ ] Proper icon references
- [ ] Version number set

**Code Quality:**
- [ ] No console errors
- [ ] Proper error handling
- [ ] Clean, commented code
- [ ] No hardcoded sensitive data

**Functionality Test:**
- [ ] Extension loads without errors
- [ ] All features work as expected
- [ ] Check-in/check-out functionality
- [ ] Location services working
- [ ] Sync functionality tested
- [ ] Notifications working

### ✅ Files to Include in ZIP

**Required Files:**
- [ ] manifest.json
- [ ] background.js
- [ ] popup.html
- [ ] popup.js
- [ ] content-script.js
- [ ] popup.css (if exists)
- [ ] icons/ folder with all icons

**Files to EXCLUDE:**
- [ ] node_modules/ (if any)
- [ ] package.json (unless required)
- [ ] .git/ folders
- [ ] README.md files
- [ ] Development files
- [ ] CHROME_STORE_CONTENT.md
- [ ] SUBMISSION_CHECKLIST.md

### ✅ Store Submission Form

**Product Details:**
- [ ] Detailed description pasted
- [ ] Category: Productivity
- [ ] Language: English
- [ ] Website URL: https://kaystonehr.com

**Graphic Assets:**
- [ ] Screenshots uploaded (1-5 images)
- [ ] Promotional images uploaded (optional)

**Additional Fields:**
- [ ] Support URL: https://kaystonehr.com/support/chrome-extension
- [ ] Developer email: developer@kaystonehr.com

**Privacy & Security:**
- [ ] Privacy policy URL or text provided
- [ ] Permission justifications explained
- [ ] Data usage disclosure completed

**Distribution:**
- [ ] Visibility: Public/Unlisted/Private selected
- [ ] Regions: Selected appropriate countries
- [ ] Pricing: Free selected

### ✅ Pre-Submission Test Commands

```bash
# Navigate to extension folder
cd extension

# Test manifest
node -e "console.log(JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')))"

# Create ZIP (exclude development files)
zip -r kaystonehr-attendance-extension.zip . -x "*.md" "node_modules/*" "*.git*" "package*.json"

# Verify ZIP contents
unzip -l kaystonehr-attendance-extension.zip
```

### ✅ Post-Submission

**After Submitting:**
- [ ] Monitor developer dashboard for status updates
- [ ] Check email for review notifications
- [ ] Prepare for potential review feedback
- [ ] Plan for post-approval marketing/distribution

**Common Review Issues to Avoid:**
- [ ] Insufficient description detail
- [ ] Missing or low-quality screenshots
- [ ] Unclear permission justifications
- [ ] Missing privacy policy
- [ ] Broken functionality

### ✅ Timeline Expectations

- **Automated Review:** 1-2 hours
- **Manual Review:** 1-3 business days
- **Complex Extensions:** Up to 7 days
- **Review Feedback:** Check developer dashboard and email

### ✅ Ready to Submit?

Once all checkboxes are complete:
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click "Add new item"
3. Upload your ZIP file
4. Fill out all required fields using content from CHROME_STORE_CONTENT.md
5. Submit for review

**Good luck with your submission! 🚀** 