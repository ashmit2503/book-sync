import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { 
  BookOpen, 
  Cloud, 
  Sparkles, 
  Volume2, 
  Accessibility, 
  ChevronRight,
  CheckCircle,
} from 'lucide-react'

const features = [
  {
    icon: Cloud,
    title: 'Cloud Library',
    description: 'Store your PDF and EPUB books securely in the cloud. Access them from any device, anywhere.',
  },
  {
    icon: Sparkles,
    title: 'AI Reading Assistant',
    description: 'Get instant answers about your books. Summaries, explanations, and insights at your fingertips.',
  },
  {
    icon: Volume2,
    title: 'Text-to-Speech',
    description: 'Listen to your books with natural voice synthesis. Perfect for commutes or multitasking.',
  },
  {
    icon: Accessibility,
    title: 'Accessible Reading',
    description: 'Dyslexia-friendly fonts, adjustable text size, and screen reader support for everyone.',
  },
]

const benefits = [
  'Upload PDF and EPUB files instantly',
  'Automatic reading progress sync',
  'AI-powered summaries and Q&A',
  'Text-to-speech with adjustable speed',
  'Auto-generated book covers',
  'Secure cloud storage',
]

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <BookOpen className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">BookSync</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link href="/login">
              <Button variant="ghost" className="transition-all hover:bg-primary/10">
                Login
              </Button>
            </Link>
            <Link href="/register">
              <Button className="transition-all hover:scale-105">
                Get Started
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              AI-Powered Reading Experience
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Your Digital Library
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                in the Cloud
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Upload, organize, and read your PDF and EPUB books anywhere. 
              Sync progress across devices with AI-powered features to enhance your reading.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/register">
                <Button size="lg" className="w-full text-lg transition-all hover:scale-105 sm:w-auto">
                  Start Reading for Free
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="w-full text-lg transition-all hover:bg-muted sm:w-auto">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="border-t bg-muted/30 py-16 sm:py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                Everything You Need to Read Better
              </h2>
              <p className="text-lg text-muted-foreground">
                Powerful features designed to enhance your digital reading experience
              </p>
            </div>
            <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-2xl border bg-card p-8 shadow-sm transition-all hover:shadow-lg hover:border-primary/50"
                >
                  <div className="mb-5 inline-flex rounded-xl bg-primary/10 p-4 transition-colors group-hover:bg-primary/20">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-16 sm:py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl">
              <div className="text-center mb-12">
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                  Reading Made Simple
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Focus on what matters most — your books. We handle the rest with 
                  seamless sync and powerful reading tools.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {benefits.map((benefit) => (
                  <div 
                    key={benefit} 
                    className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
                  >
                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-primary" />
                    <span className="text-sm font-medium">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t bg-primary/5 py-16 sm:py-24">
          <div className="container mx-auto px-4 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Ready to Start Reading?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
              Join BookSync today and transform how you read digital books. 
              Free to use with all features included.
            </p>
            <Link href="/register">
              <Button size="lg" className="text-lg transition-all hover:scale-105">
                Create Free Account
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                © 2025 BookSync. Built with Next.js and Supabase.
              </span>
            </div>
            <div className="flex items-center gap-6">
              <Link 
                href="/login" 
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Login
              </Link>
              <Link 
                href="/register" 
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
