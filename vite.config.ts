import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Repo de projeto (github.com/PersonalJoelgouveia/VolumFocus), não de
  // usuário — o Pages serve em /VolumFocus/, então os assets precisam
  // desse prefixo ou dão 404 em produção.
  base: '/VolumFocus/',
})
