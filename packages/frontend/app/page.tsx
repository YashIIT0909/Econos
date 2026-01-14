import { Navbar } from "@/components/ui/navbar"
import { HeroSection } from "@/components/sections/hero-section"
import { FeaturesSection } from "@/components/sections/features-section"
import { ArchitectureSection } from "@/components/sections/architecture-section"
import { CronosSection } from "@/components/sections/cronos-section"
import { RoadmapSection } from "@/components/sections/roadmap-section"
import { CtaSection } from "@/components/sections/cta-section"
import { FooterSection } from "@/components/sections/footer-section"

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <ArchitectureSection />
      <CronosSection />
      <RoadmapSection />
      <CtaSection />
      <FooterSection />
    </main>
  )
}
