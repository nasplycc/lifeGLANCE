import React, { useEffect, useRef } from 'react'

// Particle system inspired by bootstrapmb particle effects
// Colors tuned to match 时光墙 theme: amber (#C8A96E) and teal (#38B2AC)

const PARTICLE_CONFIG = {
  count: 120,             // Number of particles (increased from 80)
  baseRadius: 1.5,        // Base particle size
  maxRadius: 3,           // Max particle size
  baseSpeed: 0.5,         // Base movement speed (increased from 0.3)
  connectionDistance: 120, // Distance to draw connections
  mouseRadius: 150,       // Mouse interaction radius
  colors: [
    'rgba(200, 169, 110, 0.5)',  // Amber
    'rgba(56, 178, 172, 0.4)',   // Teal
    'rgba(232, 224, 208, 0.3)',  // Light text color
  ],
}

class Particle {
  constructor(canvasWidth, canvasHeight) {
    this.x = Math.random() * canvasWidth
    this.y = Math.random() * canvasHeight
    this.vx = (Math.random() - 0.5) * PARTICLE_CONFIG.baseSpeed
    this.vy = (Math.random() - 0.5) * PARTICLE_CONFIG.baseSpeed
    this.radius = PARTICLE_CONFIG.baseRadius + Math.random() * (PARTICLE_CONFIG.maxRadius - PARTICLE_CONFIG.baseRadius)
    this.color = PARTICLE_CONFIG.colors[Math.floor(Math.random() * PARTICLE_CONFIG.colors.length)]
  }

  update(width, height) {
    this.x += this.vx
    this.y += this.vy

    // Bounce off edges
    if (this.x < 0 || this.x > width) this.vx *= -1
    if (this.y < 0 || this.y > height) this.vy *= -1

    // Keep within bounds
    this.x = Math.max(0, Math.min(width, this.x))
    this.y = Math.max(0, Math.min(height, this.y))
  }

  draw(ctx) {
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
    ctx.fillStyle = this.color
    ctx.fill()
  }
}

export default function ParticleBackground() {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const mouseRef = useRef({ x: null, y: null, radius: PARTICLE_CONFIG.mouseRadius })
  const animationRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let width = window.innerWidth
    let height = window.innerHeight

    // Set canvas size
    canvas.width = width
    canvas.height = height

    // Initialize particles
    particlesRef.current = []
    for (let i = 0; i < PARTICLE_CONFIG.count; i++) {
      particlesRef.current.push(new Particle(width, height))
    }

    // Mouse move handler
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current.x = e.clientX - rect.left
      mouseRef.current.y = e.clientY - rect.top
    }

    const handleMouseLeave = () => {
      mouseRef.current.x = null
      mouseRef.current.y = null
    }

    // Resize handler
    const handleResize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height

      // Reinitialize particles on resize
      particlesRef.current = []
      for (let i = 0; i < PARTICLE_CONFIG.count; i++) {
        particlesRef.current.push(new Particle(width, height))
      }
    }

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      // Update and draw particles
      particlesRef.current.forEach((particle, index) => {
        particle.update(width, height)
        particle.draw(ctx)

        // Draw connections
        for (let j = index + 1; j < particlesRef.current.length; j++) {
          const other = particlesRef.current[j]
          const dx = particle.x - other.x
          const dy = particle.y - other.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < PARTICLE_CONFIG.connectionDistance) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(200, 169, 110, ${0.15 * (1 - distance / PARTICLE_CONFIG.connectionDistance)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(particle.x, particle.y)
            ctx.lineTo(other.x, other.y)
            ctx.stroke()
          }
        }

        // Mouse interaction
        if (mouseRef.current.x !== null) {
          const dx = particle.x - mouseRef.current.x
          const dy = particle.y - mouseRef.current.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < mouseRef.current.radius) {
            const force = (mouseRef.current.radius - distance) / mouseRef.current.radius
            const angle = Math.atan2(dy, dx)
            particle.x += Math.cos(angle) * force * 2
            particle.y += Math.sin(angle) * force * 2
          }
        }
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    // Event listeners
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="particle-background"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.6,
      }}
    />
  )
}
