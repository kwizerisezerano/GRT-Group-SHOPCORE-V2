import { useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  BarChart3,
  Package,
  ShoppingCart,
  Users,
  Shield,
  Globe,
  Zap,
  CheckCircle2,
  ArrowRight,
  Star,
  Menu,
  X,
  Monitor,
  CreditCard,
  TrendingUp,
  Building2,
  Calculator,
  Clock,
  DollarSign,
  PiggyBank,
} from "lucide-react";

import heroDashboard from "@/assets/hero-dashboard.png";
import posIllustration from "@/assets/pos-illustration.png";
import analyticsIllustration from "@/assets/analytics-illustration.png";
import multibranchIllustration from "@/assets/multibranch-illustration.png";
import mallHeroBg from "@/assets/landing-mall-hero.jpg";
import storefrontsBg from "@/assets/landing-storefronts.jpg";
import shopkeeperBg from "@/assets/landing-shopkeeper.jpg";
import retailInteriorBg from "@/assets/landing-retail-interior.jpg";
import boutiqueBg from "@/assets/bg-boutique.jpg";
import warehouseBg from "@/assets/bg-warehouse.jpg";
import { formatCurrency } from "@/utils/currency";

const features = [
  { icon: Package, title: "Product Management", desc: "Complete catalog with variants, barcodes, categories, bulk import/export, and real-time stock tracking." },
  { icon: Monitor, title: "Point of Sale", desc: "Touch-friendly POS with barcode scanning, split payments, hold/resume, and receipt printing." },
  { icon: BarChart3, title: "Smart Analytics", desc: "AI-powered sales insights, profit tracking, trend analysis, and automated reports." },
  { icon: Users, title: "CRM & Loyalty", desc: "Customer profiles, purchase history, loyalty points, credit limits, and segmentation." },
  { icon: Building2, title: "Multi-Branch", desc: "Manage unlimited branches and warehouses with inter-branch transfers and stock visibility." },
  { icon: Shield, title: "Enterprise Security", desc: "Role-based permissions, audit logs, data isolation, and two-factor authentication." },
  { icon: CreditCard, title: "Expense & Finance", desc: "Track expenses, manage supplier payments, profit margins, and daily cash summaries." },
  { icon: Globe, title: "Multi-Currency", desc: "Support for any currency, timezone, tax system, and localized invoice formatting." },
];

const testimonials = [
  { name: "Sarah K.", role: "Owner, TechHub Electronics", text: "ShopCore transformed how we manage our 8 branches. Stock transfers and real-time inventory saved us thousands.", stars: 5 },
  { name: "James O.", role: "Manager, FreshMart Supermarket", text: "The POS is incredibly fast. Our cashiers love it, and the analytics help us make better purchasing decisions.", stars: 5 },
  { name: "Amina R.", role: "Founder, Bella Boutique", text: "From a single store to 3 locations — ShopCore grew with us. The loyalty program boosted repeat customers by 40%.", stars: 5 },
];

const industries = [
  "Retail Shops", "Supermarkets", "Electronics", "Pharmacies", "Fashion",
  "Hardware", "Cosmetics", "Office Supplies", "Mobile Shops", "Wholesale",
  "Spare Parts", "Mini Markets",
];

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
};

const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
};

const slideInRight: Variants = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const heroImageVariants: Variants = {
  hidden: { opacity: 0, y: 60, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 } },
};

const statsVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
};

const statItemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
};

export default function Landing() {
  const [mobileMenu, setMobileMenu] = useState(false);

  const heroRef = useRef(null);
  const showcaseRef = useRef(null);
  const featuresRef = useRef(null);
  const pricingRef = useRef(null);
  const testimonialsRef = useRef(null);
  const industriesRef = useRef(null);
  const ctaRef = useRef(null);

  const isHeroInView = useInView(heroRef, { once: true });
  const isShowcaseInView = useInView(showcaseRef, { once: true, margin: "-100px" });
  const isFeaturesInView = useInView(featuresRef, { once: true, margin: "-100px" });
  const isPricingInView = useInView(pricingRef, { once: true, margin: "-100px" });
  const isTestimonialsInView = useInView(testimonialsRef, { once: true, margin: "-100px" });
  const isIndustriesInView = useInView(industriesRef, { once: true, margin: "-100px" });
  const isCtaInView = useInView(ctaRef, { once: true, margin: "-100px" });

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-8x2 mx-auto px-6 sm:px-5 min-h-[120px] flex items-center justify-between">
          <div className="flex items-center gap-0 py-2">
  <img
    src="/shopcore-icon.png"
    alt="ShopCore"
    className="w-20 h-20 object-contain shrink-0"
  />

  <div className="flex flex-col justify-center">
    <h1 className="text-4xl font-extrabold leading-none tracking-tight">
      ShopCore
    </h1>

    <p className="mt-2 text-sm font-semibold text-muted-foreground">
      POS & Inventory Management System
    </p>
  </div>
</div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Testimonials</a>
            <a href="#industries" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Industries</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">Login</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/auth">
                Start Free Trial <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </div>

          <button className="md:hidden" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenu && (
          <div className="md:hidden border-t bg-background p-4 space-y-3">
            <a href="#features" className="block text-sm py-2" onClick={() => setMobileMenu(false)}>Features</a>
            <a href="#pricing" className="block text-sm py-2" onClick={() => setMobileMenu(false)}>Pricing</a>
            <a href="#testimonials" className="block text-sm py-2" onClick={() => setMobileMenu(false)}>Testimonials</a>
            <Button className="w-full" asChild>
              <Link to="/auth">Start Free Trial</Link>
            </Button>
          </div>
        )}
      </nav>

      <section ref={heroRef} className="relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: `url(${mallHeroBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/40 to-background" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background/80 to-accent/10" />
        <div className="absolute top-20 -left-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-10 -right-20 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div initial="hidden" animate={isHeroInView ? "visible" : "hidden"} variants={fadeInUp}>
              <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium">
                <Zap className="w-3 h-3 mr-1" /> Trusted by 2,000+ businesses worldwide
              </Badge>
            </motion.div>

            <motion.h1
              initial="hidden"
              animate={isHeroInView ? "visible" : "hidden"}
              variants={fadeInUp}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6"
            >
              The Complete Shop
              <span className="block text-primary"> Management Platform</span>
            </motion.h1>

            <motion.p
              initial="hidden"
              animate={isHeroInView ? "visible" : "hidden"}
              variants={fadeInUp}
              transition={{ delay: 0.2 }}
              className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed"
            >
              Run your entire retail business from one powerful dashboard. Inventory, POS, sales, customers, analytics — everything connected, everywhere.
            </motion.p>

            <motion.div
              initial="hidden"
              animate={isHeroInView ? "visible" : "hidden"}
              variants={fadeInUp}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <Button size="lg" className="px-8 py-6 text-base" asChild>
                <Link to="/auth">
                  Start 14-Day Free Trial <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="px-8 py-6 text-base" asChild>
                <a href="#features">See All Features</a>
              </Button>
            </motion.div>

            <motion.p
              initial="hidden"
              animate={isHeroInView ? "visible" : "hidden"}
              variants={fadeIn}
              transition={{ delay: 0.4 }}
              className="text-xs text-muted-foreground mt-4"
            >
              No credit card required · Setup in 2 minutes · Cancel anytime
            </motion.p>

            <motion.div
              initial="hidden"
              animate={isHeroInView ? "visible" : "hidden"}
              variants={heroImageVariants}
              className="mt-12 rounded-xl overflow-hidden border shadow-2xl"
            >
              <img src={heroDashboard} alt="ShopCore dashboard" className="w-full h-auto" loading="lazy" />
            </motion.div>
          </div>

          <motion.div
            initial="hidden"
            animate={isHeroInView ? "visible" : "hidden"}
            variants={statsVariants}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto"
          >
            {[
              { value: "2,000+", label: "Businesses" },
              { value: "$50M+", label: "Sales Processed" },
              { value: "99.9%", label: "Uptime" },
              { value: "4.9/5", label: "Customer Rating" },
            ].map((s) => (
              <motion.div key={s.label} variants={statItemVariants} className="text-center p-4 rounded-xl bg-card border">
                <p className="text-2xl font-bold font-data">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section ref={showcaseRef} className="relative py-20 sm:py-28 bg-muted/30 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-[0.28]" style={{ backgroundImage: `url(${retailInteriorBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/30 to-background/50" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 space-y-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial="hidden" animate={isShowcaseInView ? "visible" : "hidden"} variants={slideInLeft}>
              <Badge variant="secondary" className="mb-4"><Monitor className="w-3 h-3 mr-1" /> Point of Sale</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Lightning-Fast Checkout</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                A touch-friendly POS designed for speed. Barcode scanning, split payments, hold & resume, customer accounts, and instant receipt printing — all in one screen.
              </p>
              <ul className="space-y-2">
                {["Barcode & QR scanning", "Split & partial payments", "Offline mode support", "Receipt printing & email"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div initial="hidden" animate={isShowcaseInView ? "visible" : "hidden"} variants={slideInRight} className="flex justify-center">
              <img src={posIllustration} alt="Point of Sale illustration" className="w-full max-w-md" loading="lazy" />
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial="hidden" animate={isShowcaseInView ? "visible" : "hidden"} variants={slideInLeft} className="order-2 lg:order-1 flex justify-center">
              <img src={analyticsIllustration} alt="Analytics dashboard" className="w-full max-w-md" loading="lazy" />
            </motion.div>

            <motion.div initial="hidden" animate={isShowcaseInView ? "visible" : "hidden"} variants={slideInRight} className="order-1 lg:order-2">
              <Badge variant="secondary" className="mb-4"><BarChart3 className="w-3 h-3 mr-1" /> Analytics</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Data-Driven Decisions</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Understand your business like never before. Track sales trends, profit margins, top products, peak hours, and customer behavior with beautiful dashboards.
              </p>
              <ul className="space-y-2">
                {["Real-time sales tracking", "Profit & margin analysis", "Customer behavior insights", "Automated daily reports"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial="hidden" animate={isShowcaseInView ? "visible" : "hidden"} variants={slideInLeft}>
              <Badge variant="secondary" className="mb-4"><Building2 className="w-3 h-3 mr-1" /> Multi-Branch</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Scale Without Limits</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Manage every branch and warehouse from one dashboard. Track stock across locations, automate transfers, and keep every team aligned in real time.
              </p>
              <ul className="space-y-2">
                {["Centralized stock visibility", "Inter-branch transfers", "Branch-level reporting", "Role-based access per branch"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div initial="hidden" animate={isShowcaseInView ? "visible" : "hidden"} variants={slideInRight} className="flex justify-center">
              <img src={multibranchIllustration} alt="Multi-branch management" className="w-full max-w-md" loading="lazy" />
            </motion.div>
          </div>
        </div>
      </section>

      <section ref={featuresRef} id="features" className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-[0.22]" style={{ backgroundImage: `url(${boutiqueBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background/70" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial="hidden" animate={isFeaturesInView ? "visible" : "hidden"} variants={fadeInUp} className="text-center mb-14">
            <Badge variant="secondary" className="mb-4">All Features</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything You Need to Run Your Shop</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From inventory to analytics, ShopCore gives you every tool to manage, grow, and scale your retail business.
            </p>
          </motion.div>

          <motion.div initial="hidden" animate={isFeaturesInView ? "visible" : "hidden"} variants={staggerContainer} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f) => (
              <motion.div key={f.title} variants={scaleIn} className="bg-card rounded-xl border p-6 hover:shadow-lg hover:border-primary/20 transition-all group">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <f.icon className="w-5 h-5 text-primary group-hover:text-primary-foreground" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section ref={pricingRef} id="pricing" className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-[0.20]" style={{ backgroundImage: `url(${warehouseBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial="hidden" animate={isPricingInView ? "visible" : "hidden"} variants={fadeInUp} className="text-center mb-14">
            <Badge variant="secondary" className="mb-4"><Calculator className="w-3 h-3 mr-1" /> ROI Calculator</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">See How Much ShopCore Saves You</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Move the sliders to match your business. We'll show you the time, money, and stockouts ShopCore eliminates every month.
            </p>
          </motion.div>

          <motion.div initial="hidden" animate={isPricingInView ? "visible" : "hidden"} variants={scaleIn}>
            <ROICalculator />
          </motion.div>
        </div>
      </section>

      <section ref={testimonialsRef} id="testimonials" className="py-20 sm:py-28 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div initial="hidden" animate={isTestimonialsInView ? "visible" : "hidden"} variants={fadeInUp} className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">Customer impact board</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Real wins, in real numbers</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Outcomes shipped by ShopCore tenants in the last 30 days — beyond stars, what we actually move.
            </p>
          </motion.div>

          <motion.div initial="hidden" animate={isTestimonialsInView ? "visible" : "hidden"} variants={staggerContainer} className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              { metric: "+38%", label: "Avg. repeat-customer rate", note: "Bella Boutique · 3 stores · loyalty tier rollout", color: "text-accent" },
              { metric: "−72%", label: "Stockouts on top SKUs", note: "FreshMart · 12 branches · auto-reorder triggers", color: "text-primary" },
              { metric: "4.2h", label: "Saved per week / branch", note: "TechHub Electronics · 8 branches · POS + transfer flow", color: "text-warning" },
              { metric: "$18.4k", label: "Recovered from shrinkage", note: "Across 47 tenants · stock-count reconciliation", color: "text-accent" },
              { metric: "11s", label: "Median checkout time", note: "Touch POS · barcode scanner · split tender", color: "text-primary" },
              { metric: "99.97%", label: "Cross-tenant isolation pass rate", note: "Verified by the QA E2E suite, every deploy", color: "text-warning" },
            ].map((m) => (
              <motion.div key={m.label} variants={scaleIn} className="group relative bg-card rounded-xl border p-6 overflow-hidden hover:border-primary/40 transition-colors">
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/10 transition-colors" />
                <div className="relative">
                  <p className={`text-4xl font-bold font-data ${m.color}`}>{m.metric}</p>
                  <p className="text-sm font-semibold mt-2">{m.label}</p>
                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{m.note}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial="hidden" animate={isTestimonialsInView ? "visible" : "hidden"} variants={fadeInUp} className="rounded-2xl border bg-card p-6 sm:p-8 max-w-5xl mx-auto">
            <div className="grid sm:grid-cols-3 gap-4 text-xs">
              {testimonials.map((t) => (
                <blockquote key={t.name} className="border-l-2 border-primary/40 pl-3 py-1">
                  <p className="text-foreground/90 leading-relaxed mb-1.5">"{t.text}"</p>
                  <footer className="text-[11px] text-muted-foreground">— {t.name} · {t.role}</footer>
                </blockquote>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section ref={industriesRef} id="industries" className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-[0.28]" style={{ backgroundImage: `url(${storefrontsBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/70 to-background" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center relative">
          <motion.div initial="hidden" animate={isIndustriesInView ? "visible" : "hidden"} variants={fadeInUp}>
            <Badge variant="secondary" className="mb-4">Industries</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Built for Every Type of Shop</h2>
            <p className="text-muted-foreground mb-10 max-w-xl mx-auto">
              Whether you run a single boutique or a chain of supermarkets, ShopCore adapts to your business.
            </p>
          </motion.div>

          <motion.div initial="hidden" animate={isIndustriesInView ? "visible" : "hidden"} variants={staggerContainer} className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
            {industries.map((ind) => (
              <motion.div key={ind} variants={scaleIn}>
                <Badge variant="outline" className="px-4 py-2 text-sm">{ind}</Badge>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section ref={ctaRef} className="relative py-20 sm:py-28 bg-primary text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay" style={{ backgroundImage: `url(${shopkeeperBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/95 to-primary/80" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
          <motion.div initial="hidden" animate={isCtaInView ? "visible" : "hidden"} variants={fadeInUp} className="text-center mb-10">
            <Badge variant="secondary" className="mb-4 px-3 py-1 text-xs">⚡ Build your stack in 60 seconds</Badge>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 leading-tight">
              Pick the shop modules you need.<br />
              <span className="text-accent">We'll spin them up instantly.</span>
            </h2>
            <p className="text-lg opacity-80 max-w-2xl mx-auto">
              Toggle the modules below — your live workspace is ready before this page finishes loading.
            </p>
          </motion.div>

          <StackBuilder isInView={isCtaInView} />
        </div>
      </section>

      <footer className="border-t bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/shopcore-logo.png" alt="ShopCore" className="w-10 h-10 object-contain" />
              <div className="leading-tight">
                <p className="font-bold text-sm">ShopCore</p>
                <p className="text-[11px] text-muted-foreground">Built for modern retail · multi-tenant by design</p>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              <a href="#industries" className="hover:text-foreground transition-colors">Industries</a>
              <span className="h-3 w-px bg-border" />
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Support</a>
            </nav>

            <p className="text-[11px] text-muted-foreground">© {new Date().getFullYear()} ShopCore · All rights reserved</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

type StackModule = { id: string; name: string; icon: typeof Monitor; weight: number; must?: boolean };

const STACK_MODULES: StackModule[] = [
  { id: "pos", name: "Point of Sale", icon: Monitor, weight: 1, must: true },
  { id: "inv", name: "Inventory & Warehouses", icon: Package, weight: 1, must: true },
  { id: "crm", name: "Customers & Loyalty", icon: Users, weight: 1.2 },
  { id: "branch", name: "Multi-Branch Sync", icon: Building2, weight: 1.5 },
  { id: "ai", name: "AI Assistant + Insights", icon: Zap, weight: 1.4 },
  { id: "rep", name: "Reports & Exports", icon: BarChart3, weight: 1 },
  { id: "exp", name: "Expenses & Finance", icon: CreditCard, weight: 1.1 },
  { id: "sec", name: "Roles & Audit Logs", icon: Shield, weight: 1.3 },
];

function StackBuilder({ isInView }: { isInView: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(["pos", "inv", "crm", "rep"]));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const m = STACK_MODULES.find((x) => x.id === id);
      if (m?.must) return next;
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const score = useMemo(() => {
    return STACK_MODULES.filter((m) => selected.has(m.id)).reduce((acc, m) => acc + m.weight, 0);
  }, [selected]);

  const plan = score >= 7 ? "Enterprise" : score >= 4.5 ? "Professional" : "Starter";
  const eta = Math.max(8, Math.round(60 - selected.size * 5));
  const monthly = plan === "Enterprise" ? 199 : plan === "Professional" ? 79 : 29;

  return (
    <motion.div initial="hidden" animate={isInView ? "visible" : "hidden"} variants={fadeInUp} className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
      <div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 backdrop-blur p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold opacity-90">Select your modules</p>
          <Badge variant="secondary" className="text-[10px]">{selected.size} of {STACK_MODULES.length} selected</Badge>
        </div>

        <div className="grid sm:grid-cols-2 gap-2.5">
          {STACK_MODULES.map((m, idx) => {
            const active = selected.has(m.id);
            const Icon = m.icon;

            return (
              <motion.button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                initial={{ opacity: 0, y: 12 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.04 * idx, duration: 0.35 }}
                whileHover={{ scale: m.must ? 1 : 1.02 }}
                className={`group relative flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all ${
                  active
                    ? "border-accent/60 bg-accent/15 shadow-[0_0_0_1px_hsl(var(--accent)/0.4)]"
                    : "border-primary-foreground/15 bg-primary-foreground/[0.04] hover:border-primary-foreground/30"
                } ${m.must ? "cursor-default" : "cursor-pointer"}`}
                aria-pressed={active}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${active ? "bg-accent text-accent-foreground" : "bg-primary-foreground/10"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  <p className="text-[11px] opacity-70">{m.must ? "Always included" : active ? "Included in your stack" : "Tap to add"}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${active ? "border-accent bg-accent" : "border-primary-foreground/40"}`}>
                  {active && <CheckCircle2 className="w-3.5 h-3.5 text-accent-foreground" />}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <motion.div layout className="rounded-2xl border-2 border-accent/40 bg-gradient-to-br from-primary-foreground/10 to-accent/10 backdrop-blur p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <Sparkle />
          <p className="text-xs uppercase tracking-widest opacity-80">Recommended for you</p>
        </div>

        <h3 className="text-3xl font-bold mb-1">{plan}</h3>
        <p className="text-sm opacity-80 mb-5">Tailored to the {selected.size} modules you picked.</p>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <SummaryStat icon={DollarSign} label="from" value={formatCurrency(monthly)} suffix="/mo" />
          <SummaryStat icon={Clock} label="ready in" value={`${eta}s`} />
          <SummaryStat icon={TrendingUp} label="modules" value={`${selected.size}`} />
        </div>

        <div className="space-y-1.5 mb-6 text-xs opacity-90">
          {STACK_MODULES.filter((m) => selected.has(m.id)).slice(0, 4).map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="truncate">{m.name}</span>
            </div>
          ))}
          {selected.size > 4 && <p className="text-[11px] opacity-70 pl-5">+ {selected.size - 4} more</p>}
        </div>

        <div className="mt-auto space-y-2">
          <Button size="lg" variant="secondary" className="w-full text-base font-semibold gap-2" asChild>
            <Link to="/auth">
              <Zap className="w-4 h-4" /> Spin up my workspace
              <ArrowRight className="w-4 h-4 ml-auto" />
            </Link>
          </Button>

          <Button size="sm" variant="ghost" className="w-full text-xs text-primary-foreground/80 hover:bg-primary-foreground/10" asChild>
            <a href="mailto:hello@shopcore.io">Talk to a human first →</a>
          </Button>

          <p className="text-center text-[11px] opacity-70 pt-1">14-day trial · no credit card · cancel anytime</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SummaryStat({ icon: Icon, label, value, suffix }: { icon: typeof Clock; label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-lg bg-primary-foreground/10 border border-primary-foreground/15 p-2.5 text-center">
      <Icon className="w-3.5 h-3.5 mx-auto mb-1 opacity-70" />
      <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-base font-bold leading-tight">
        {value}
        <span className="text-xs opacity-70">{suffix}</span>
      </p>
    </div>
  );
}

function Sparkle() {
  return (
    <motion.span
      animate={{ rotate: [0, 12, -8, 0], scale: [1, 1.15, 1] }}
      transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
      className="inline-block"
    >
      <Star className="w-4 h-4 text-accent fill-accent" />
    </motion.span>
  );
}

function ROICalculator() {
  const [branches, setBranches] = useState(2);
  const [skus, setSkus] = useState(800);
  const [monthlyOrders, setMonthlyOrders] = useState(1500);

  const numbers = useMemo(() => {
    const hoursSavedPerMonth = Math.round(branches * 12 + Math.min(skus, 5000) * 0.02 + monthlyOrders * 0.01);
    const stockoutsAvoided = Math.round(skus * 0.04 + branches * 6);
    const moneySaved = Math.round(hoursSavedPerMonth * 25 + stockoutsAvoided * 18);

    let plan: { name: string; price: number; tag: string; desc: string };

    if (branches <= 1 && skus <= 500) {
      plan = { name: "Starter", price: 29, tag: "Best for single shops", desc: "1 branch · 2 users · 500 products" };
    } else if (branches <= 5 && skus <= 10000) {
      plan = { name: "Professional", price: 79, tag: "Most popular", desc: "5 branches · 10 users · unlimited products" };
    } else {
      plan = { name: "Enterprise", price: 199, tag: "Built for scale", desc: "Unlimited branches, users & API access" };
    }

    const paybackDays = Math.max(1, Math.round((plan.price / Math.max(moneySaved, 1)) * 30));

    return { hoursSavedPerMonth, stockoutsAvoided, moneySaved, plan, paybackDays };
  }, [branches, skus, monthlyOrders]);

  return (
    <div className="grid lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
      <div className="lg:col-span-3 bg-card border rounded-2xl p-7 shadow-sm">
        <h3 className="text-lg font-semibold mb-1">Tell us about your business</h3>
        <p className="text-sm text-muted-foreground mb-6">Three quick inputs — no form, no email required.</p>

        <div className="space-y-7">
          <SliderRow icon={<Building2 className="w-4 h-4" />} label="Number of branches" value={branches} display={branches >= 20 ? "20+" : String(branches)} min={1} max={20} step={1} onChange={setBranches} />
          <SliderRow icon={<Package className="w-4 h-4" />} label="Active SKUs" value={skus} display={skus >= 10000 ? "10,000+" : skus.toLocaleString()} min={50} max={10000} step={50} onChange={setSkus} />
          <SliderRow icon={<ShoppingCart className="w-4 h-4" />} label="Monthly orders" value={monthlyOrders} display={monthlyOrders >= 20000 ? "20,000+" : monthlyOrders.toLocaleString()} min={100} max={20000} step={100} onChange={setMonthlyOrders} />
        </div>

        <div className="mt-7 grid grid-cols-3 gap-3 pt-6 border-t">
          <ImpactStat icon={<Clock className="w-4 h-4" />} label="Hours saved / month" value={`${numbers.hoursSavedPerMonth}h`} />
          <ImpactStat icon={<Package className="w-4 h-4" />} label="Stockouts avoided" value={String(numbers.stockoutsAvoided)} />
          <ImpactStat icon={<DollarSign className="w-4 h-4" />} label="Estimated monthly savings" value={formatCurrency(numbers.moneySaved)} highlight />
        </div>
      </div>

      <div className="lg:col-span-2 relative bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-2xl p-7 shadow-xl overflow-hidden">
        <div className="relative">
          <Badge variant="secondary" className="mb-4">{numbers.plan.tag}</Badge>
          <h3 className="text-2xl font-bold">{numbers.plan.name}</h3>
          <p className="text-sm opacity-80 mt-1">{numbers.plan.desc}</p>

          <div className="mt-6 flex items-baseline gap-1">
            <span className="text-5xl font-extrabold font-data">
              {formatCurrency(Number(numbers.plan.price ?? 0))}
            </span>
            <span className="opacity-80">/month</span>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 backdrop-blur px-3 py-1.5 text-xs">
            <PiggyBank className="w-3.5 h-3.5" />
            Pays for itself in <span className="font-bold">~{numbers.paybackDays} day{numbers.paybackDays === 1 ? "" : "s"}</span>
          </div>

          <Button size="lg" variant="secondary" className="w-full mt-6 gap-1.5" asChild>
            <Link to="/auth">
              Start free trial <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>

          <ul className="mt-6 space-y-2.5 text-sm">
            {["14-day free trial — no credit card", "Cancel anytime", "Switch plans as you grow", "All features included for trial"].map((f) => (
              <li key={f} className="flex items-center gap-2 opacity-90">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="lg:col-span-5 grid sm:grid-cols-3 gap-3">
        {[
          { name: "Starter", price: 29, blurb: "1 branch · 500 products" },
          { name: "Professional", price: 79, blurb: "5 branches · unlimited products" },
          { name: "Enterprise", price: 199, blurb: "Unlimited everything · API" },
        ].map((p) => {
          const active = p.name === numbers.plan.name;

          return (
            <div key={p.name} className={`rounded-xl border p-4 flex items-center justify-between transition-all ${active ? "border-primary bg-primary/5 shadow-md" : "bg-card hover:border-muted-foreground/30"}`}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{p.name}</p>
                  {active && <Badge className="text-[10px] h-5">Recommended</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{p.blurb}</p>
              </div>

              <div className="text-right">
                <p className="font-data font-bold text-lg">${p.price}</p>
                <p className="text-[10px] text-muted-foreground">/month</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SliderRow({
  icon,
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <span className="text-primary">{icon}</span> {label}
        </label>
        <span className="font-data font-bold text-sm tabular-nums">{display}</span>
      </div>

      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function ImpactStat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-accent/40 bg-accent/5" : "bg-background/60"}`}>
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wide ${highlight ? "text-accent" : "text-muted-foreground"}`}>
        {icon} {label}
      </div>
      <p className={`mt-1 font-data font-bold ${highlight ? "text-2xl text-accent" : "text-lg"}`}>{value}</p>
    </div>
  );
}
