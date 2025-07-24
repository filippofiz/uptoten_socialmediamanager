# GitHub Pages Deployment Guide for Up to Ten Social Media Manager

This guide walks you through deploying the Up to Ten Social Media Manager to GitHub Pages.

## Prerequisites

- GitHub account
- Git installed on your local machine
- Repository already created at: https://github.com/filippofiz/uptoten_socialmediamanager.git

## Step 1: Initialize Git and Push to GitHub

If you haven't already initialized git in your project:

```bash
cd "C:\App UpToTen\Social Media Manager"
git init
git add .
git commit -m "Initial commit - Up to Ten Social Media Manager"
git branch -M main
git remote add origin https://github.com/filippofiz/uptoten_socialmediamanager.git
git push -u origin main
```

## Step 2: Enable GitHub Pages

1. Go to your repository on GitHub: https://github.com/filippofiz/uptoten_socialmediamanager
2. Click on **Settings** tab
3. Scroll down to **Pages** section in the left sidebar
4. Under **Source**, select **GitHub Actions**
5. Save the changes

## Step 3: Deploy via GitHub Actions

The deployment will happen automatically when you push to the main branch. The GitHub Actions workflow (`.github/workflows/deploy.yml`) is already configured.

To trigger a deployment:

```bash
git add .
git commit -m "Deploy to GitHub Pages"
git push origin main
```

## Step 4: Access Your Site

After the deployment workflow completes (usually takes 2-5 minutes), your site will be available at:

**https://filippofiz.github.io/uptoten_socialmediamanager/**

## Project Structure

```
/
├── index.html                 # Main landing page
├── dashboard-zapier.html      # Main dashboard application
├── generate-token.html        # Token generation tool
├── update-token.html          # Token update tool
├── fix-facebook-token.html    # Facebook token fix utility
├── zapier-integration.html    # Zapier integration page
├── all-in-one-dashboard.html  # Comprehensive dashboard
├── alternative-solutions.html # Alternative integration options
├── _config.yml               # Jekyll configuration
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions deployment workflow
└── public/                   # Static assets directory
```

## Important URLs After Deployment

- **Homepage**: https://filippofiz.github.io/uptoten_socialmediamanager/
- **Dashboard**: https://filippofiz.github.io/uptoten_socialmediamanager/dashboard-zapier.html
- **Token Generator**: https://filippofiz.github.io/uptoten_socialmediamanager/generate-token.html
- **Zapier Integration**: https://filippofiz.github.io/uptoten_socialmediamanager/zapier-integration.html

## Updating the Site

To update your site with new changes:

1. Make your changes locally
2. Test them by opening the HTML files in your browser
3. Commit and push to GitHub:

```bash
git add .
git commit -m "Update: [describe your changes]"
git push origin main
```

4. GitHub Actions will automatically redeploy your site

## Monitoring Deployments

You can monitor the deployment status:

1. Go to your repository on GitHub
2. Click on the **Actions** tab
3. You'll see the deployment workflow running or completed
4. Click on a workflow run to see detailed logs

## Troubleshooting

### Site Not Loading

- Check if GitHub Pages is enabled in repository settings
- Verify the deployment workflow completed successfully in the Actions tab
- Clear your browser cache and try again
- Check the correct URL format with the repository name

### 404 Errors

- Ensure all file paths in HTML files are relative
- Check that the `_config.yml` baseurl matches your repository name
- Verify files are not excluded in `_config.yml`

### Deployment Failures

- Check the Actions tab for error messages
- Ensure the `.github/workflows/deploy.yml` file is properly formatted
- Verify you have the correct permissions on the repository

## Custom Domain (Optional)

To use a custom domain:

1. In repository Settings > Pages
2. Add your custom domain under "Custom domain"
3. Create a CNAME file in the root directory with your domain
4. Configure your domain's DNS settings to point to GitHub Pages

## Security Considerations

- Never commit sensitive information (API keys, tokens, passwords)
- Use environment variables or GitHub Secrets for sensitive data
- Keep the `backend/` directory excluded from the deployed site
- Regularly review and update dependencies

## Support

For issues specific to:
- **GitHub Pages**: Check [GitHub Pages documentation](https://docs.github.com/en/pages)
- **GitHub Actions**: Review [GitHub Actions documentation](https://docs.github.com/en/actions)
- **Application Issues**: Check the browser console for errors

## Next Steps

1. Push your code to GitHub
2. Enable GitHub Pages
3. Wait for deployment to complete
4. Share your deployed application URL
5. Set up monitoring and analytics (optional)

Remember to keep your repository public for free GitHub Pages hosting, or upgrade to GitHub Pro for private repository hosting.