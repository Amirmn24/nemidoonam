import { useEffect, useLayoutEffect } from 'react'
import * as THREE from 'three'

export function useLandingScene(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 120)
    camera.position.set(0, 0.6, 15)
    const root = new THREE.Group()
    scene.add(root)

    scene.add(new THREE.AmbientLight(0x9aa0ff, 0.55))
    const pl1 = new THREE.PointLight(0x4f46e5, 1.3)
    pl1.position.set(6, 6, 8)
    scene.add(pl1)
    const pl2 = new THREE.PointLight(0x8b5cf6, 1.0)
    pl2.position.set(-7, -4, 6)
    scene.add(pl2)

    const book = new THREE.Group()
    book.position.y = -0.3
    root.add(book)
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, roughness: 0.35, metalness: 0.3 })
    const pageMat = new THREE.MeshStandardMaterial({
      color: 0xe6e7ff,
      roughness: 0.55,
      metalness: 0,
      side: THREE.DoubleSide,
    })

    function makeCover(side) {
      const g = new THREE.Group()
      const m = new THREE.Mesh(new THREE.BoxGeometry(4.8, 6.4, 0.14), coverMat)
      m.position.x = side * 2.4
      g.add(m)
      const p = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 6.1), pageMat)
      p.position.set(side * 2.4, 0, 0.11)
      g.add(p)
      g.rotation.y = side * 0.55
      return g
    }
    book.add(makeCover(-1))
    book.add(makeCover(1))
    book.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 6.4, 0.3), coverMat))

    const flipGeo = new THREE.PlaneGeometry(4.5, 6.1)
    flipGeo.translate(2.25, 0, 0)
    const flips = []
    for (let i = 0; i < 2; i += 1) {
      const fm = pageMat.clone()
      fm.transparent = true
      fm.opacity = 0.92
      const f = new THREE.Mesh(flipGeo, fm)
      f.position.z = 0.16 + i * 0.03
      book.add(f)
      flips.push(f)
    }

    const crys = []
    const cg = new THREE.OctahedronGeometry(0.5)
    for (let c = 0; c < 10; c += 1) {
      const cm = new THREE.Mesh(
        cg,
        new THREE.MeshStandardMaterial({
          color: c % 2 ? 0x8b5cf6 : 0x6366f1,
          roughness: 0.3,
          metalness: 0.5,
          transparent: true,
          opacity: 0.85,
        }),
      )
      const r = 7 + Math.random() * 4
      const a = Math.random() * Math.PI * 2
      cm.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 8, Math.sin(a) * r - 2)
      cm.scale.setScalar(0.4 + Math.random() * 1.1)
      root.add(cm)
      crys.push(cm)
    }

    const N = 700
    const pos = new Float32Array(N * 3)
    for (let k = 0; k < N; k += 1) {
      const rr = 5 + Math.random() * 7
      const aa = Math.random() * Math.PI * 2
      pos[k * 3] = Math.cos(aa) * rr
      pos[k * 3 + 1] = (Math.random() - 0.5) * 10
      pos[k * 3 + 2] = Math.sin(aa) * rr
    }
    const pg = new THREE.BufferGeometry()
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const pts = new THREE.Points(
      pg,
      new THREE.PointsMaterial({
        color: 0x8f94ff,
        size: 0.07,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    root.add(pts)

    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(7.4, 0.02, 8, 140),
      new THREE.MeshBasicMaterial({ color: 0x4f46e5, transparent: true, opacity: 0.5 }),
    )
    ring1.rotation.x = 1.25
    root.add(ring1)
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(8.6, 0.015, 8, 140),
      new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.35 }),
    )
    ring2.rotation.x = 1.9
    ring2.rotation.y = 0.6
    root.add(ring2)

    function glowTex() {
      const cv = document.createElement('canvas')
      cv.width = 256
      cv.height = 256
      const x = cv.getContext('2d')
      const g = x.createRadialGradient(128, 128, 0, 128, 128, 128)
      g.addColorStop(0, 'rgba(130,130,255,.85)')
      g.addColorStop(0.4, 'rgba(90,80,240,.3)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      x.fillStyle = g
      x.fillRect(0, 0, 256, 256)
      return new THREE.CanvasTexture(cv)
    }
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    )
    glow.scale.set(17, 17, 1)
    root.add(glow)

    let mx = 0
    let my = 0
    let raf = 0
    let alive = true

    const onMove = (e) => {
      mx = e.clientX / window.innerWidth - 0.5
      my = e.clientY / window.innerHeight - 0.5
    }
    const layout = () => {
      book.scale.setScalar(window.innerWidth < 820 ? 0.72 : 1)
    }
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight, false)
      layout()
    }

    layout()
    const clock = new THREE.Clock()
    const tick = () => {
      if (!alive) return
      const t = clock.getElapsedTime()
      book.rotation.y = Math.sin(t * 0.22) * 0.25 + mx * 0.35
      book.rotation.x = my * 0.18 + Math.sin(t * 0.5) * 0.03
      for (let q = 0; q < flips.length; q += 1) {
        flips[q].rotation.y = 0.55 + (Math.PI - 1.1) * (0.5 + 0.5 * Math.sin(t * 0.5 + q * 2.4))
      }
      pts.rotation.y = t * 0.05
      ring1.rotation.z = t * 0.1
      ring2.rotation.z = -t * 0.08
      for (let j = 0; j < crys.length; j += 1) {
        crys[j].rotation.x += 0.004 + j * 0.0004
        crys[j].rotation.y += 0.006
        crys[j].position.y += Math.sin(t * 1.2 + j) * 0.002
      }
      root.rotation.y = window.scrollY * 0.00045 + mx * 0.08
      root.position.y = -Math.min(window.scrollY * 0.0012, 3)
      camera.position.x += (mx * 1.2 - camera.position.x) * 0.04
      camera.position.y += (-my * 0.8 + 0.6 - camera.position.y) * 0.04
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('resize', onResize)
    raf = requestAnimationFrame(tick)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      flipGeo.dispose()
      cg.dispose()
      pg.dispose()
    }
  }, [canvasRef])
}

export function useLandingUi(rootRef, revision = 0) {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    // React resets className on language change and drops `.in` — restore before paint.
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' },
    )

    root.querySelectorAll('.reveal').forEach((el) => {
      const top = el.getBoundingClientRect().top
      if (top < window.innerHeight * 0.92) {
        el.classList.add('in')
      } else {
        io.observe(el)
      }
    })

    return () => io.disconnect()
  }, [rootRef, revision])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    const header = root.querySelector('[data-landing-nav]')
    const burger = root.querySelector('[data-landing-burger]')
    const navLinks = root.querySelector('[data-landing-nav-links]')
    const mock = root.querySelector('[data-mock]')
    const scene = mock?.closest('.scene3d')

    const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 30)
    const onBurger = () => header?.classList.toggle('open')
    const closeNav = () => header?.classList.remove('open')

    window.addEventListener('scroll', onScroll, { passive: true })
    burger?.addEventListener('click', onBurger)
    navLinks?.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeNav))

    const tiltCleanups = []
    root.querySelectorAll('[data-tilt]').forEach((el) => {
      const onMove = (ev) => {
        const r = el.getBoundingClientRect()
        const px = (ev.clientX - r.left) / r.width - 0.5
        const py = (ev.clientY - r.top) / r.height - 0.5
        el.style.setProperty('--mx', `${(px + 0.5) * 100}%`)
        el.style.setProperty('--my', `${(py + 0.5) * 100}%`)
        el.style.transform = `perspective(950px) rotateY(${px * 8}deg) rotateX(${py * -8}deg) translateY(-6px)`
      }
      const onLeave = () => {
        el.style.transform = ''
      }
      el.addEventListener('mousemove', onMove)
      el.addEventListener('mouseleave', onLeave)
      tiltCleanups.push(() => {
        el.removeEventListener('mousemove', onMove)
        el.removeEventListener('mouseleave', onLeave)
      })
    })

    let onSceneMove
    let onSceneLeave
    if (mock && scene) {
      onSceneMove = (ev) => {
        if (ev.target.closest('.float-ff')) return
        const r = scene.getBoundingClientRect()
        const px = (ev.clientX - r.left) / r.width - 0.5
        const py = (ev.clientY - r.top) / r.height - 0.5
        mock.style.transform = `rotateY(${px * 10}deg) rotateX(${py * -10}deg)`
      }
      onSceneLeave = () => {
        mock.style.transform = ''
      }
      scene.addEventListener('mousemove', onSceneMove)
      scene.addEventListener('mouseleave', onSceneLeave)
    }

    const faqCleanups = []
    root.querySelectorAll('.faq-item').forEach((item) => {
      const btn = item.querySelector('.faq-q')
      const onFaq = () => {
        const wasOpen = item.classList.contains('open')
        root.querySelectorAll('.faq-item.open').forEach((o) => {
          o.classList.remove('open')
          o.querySelector('.faq-a').style.maxHeight = null
        })
        if (!wasOpen) {
          item.classList.add('open')
          const a = item.querySelector('.faq-a')
          a.style.maxHeight = `${a.scrollHeight}px`
        }
      }
      btn?.addEventListener('click', onFaq)
      faqCleanups.push(() => btn?.removeEventListener('click', onFaq))
    })

    return () => {
      window.removeEventListener('scroll', onScroll)
      burger?.removeEventListener('click', onBurger)
      navLinks?.querySelectorAll('a').forEach((a) => a.removeEventListener('click', closeNav))
      tiltCleanups.forEach((fn) => fn())
      if (scene && onSceneMove) scene.removeEventListener('mousemove', onSceneMove)
      if (scene && onSceneLeave) scene.removeEventListener('mouseleave', onSceneLeave)
      faqCleanups.forEach((fn) => fn())
    }
  }, [rootRef, revision])
}
