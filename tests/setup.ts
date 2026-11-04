import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { config } from 'dotenv'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

config({ path: '.env.local', quiet: true })
