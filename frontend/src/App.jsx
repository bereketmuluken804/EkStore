import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react'

function App() {

  return (
    <header>
      <Show when="signed-out">
        <SignInButton mode='modal'/>
        <SignUpButton mode='modal'/>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </header>
  )
}

export default App
