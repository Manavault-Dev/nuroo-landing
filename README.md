# Nuroo Landing Page

A professional, modern, and SEO-optimized landing page for Nuroo - an AI-powered autism support platform.

## 🚀 Features

- **Next.js 14** with App Router and TypeScript
- **TailwindCSS** for modern, responsive styling
- **SEO Optimized** with metadata, Open Graph, and Twitter cards
- **Dark Mode** support with system preference detection
- **Accessibility** features (ARIA labels, semantic HTML)
- **Performance** optimized with Core Web Vitals in mind
- **Mobile-First** responsive design

## 📱 Sections

- **Hero Section** - Compelling headline with CTA
- **Problem Section** - Autism challenges and statistics
- **Solution Section** - Nuroo app features and benefits
- **Features Grid** - Detailed feature breakdown
- **Testimonials** - Social proof from families
- **Waitlist Form** - Email signup with Firebase integration
- **Footer** - Links, contact info, and social media

## 🛠 Tech Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Icons**: Lucide React
- **Fonts**: Inter (Google Fonts)
- **SEO**: Built-in Next.js metadata API
- **Deployment**: Vercel-ready

## 🚀 Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```

3. **Open [http://localhost:3000](http://localhost:3000)** in your browser

## 📦 Build for Production

```bash
npm run build
npm start
```

## 🎨 Customization

### Colors
The design uses a custom color palette defined in `tailwind.config.js`:
- **Primary**: #1D2B64 (Deep blue)
- **Teal**: #14b8a6 (Accent color)
- **Gradients**: Various combinations for visual appeal

### Components
All components are modular and reusable:
- `Hero.tsx` - Main landing section
- `Problem.tsx` - Problem statement
- `Solution.tsx` - Product showcase
- `Features.tsx` - Feature grid
- `Testimonials.tsx` - Social proof
- `WaitlistForm.tsx` - Email signup
- `Footer.tsx` - Site footer
- `Header.tsx` - Navigation
- `ThemeProvider.tsx` - Dark mode

## 🔧 Configuration

### Environment Variables
Create a `.env.local` file for Firebase configuration:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
```

### SEO Settings
Update metadata in `app/layout.tsx`:
- Site name and description
- Open Graph images
- Twitter handle
- Google verification code

## 📊 Performance

The site is optimized for Core Web Vitals:
- **LCP**: Optimized images and fonts
- **FID**: Minimal JavaScript execution
- **CLS**: Stable layouts and animations

## 🌐 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Configure environment variables
3. Deploy automatically on push

### Other Platforms
The site is compatible with any platform that supports Next.js:
- Netlify
- AWS Amplify
- Railway
- DigitalOcean App Platform

## 📝 License

This project is proprietary to Nuroo. All rights reserved.

## 🤝 Contributing

For internal team members, please follow our development guidelines:
1. Create feature branches
2. Write descriptive commit messages
3. Test on multiple devices
4. Update documentation as needed

---

Built with ❤️ by the Nuroo team
