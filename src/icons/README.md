# Sistema de ícones — VolumFocus

Ícones de navegação centralizados em `lucide-react`, substituindo os emojis
antigos (`VIEW_ICON` em `src/types/view.ts`, agora removido).

## Arquivos

- `iconMap.tsx` — mapa `ViewId → ícone Lucide` (`VIEW_ICON_MAP`) + ícones de
  ação fora do fluxo de navegação (`ACTION_ICON_MAP`) + `NavIconGraphic`, o
  componente que a Sidebar/MobileSidebar usam para renderizar o SVG.
- `index.ts` — reexporta tudo do `iconMap.tsx`. Sempre importe daqui
  (`from '../../icons'`), nunca direto de `iconMap.tsx`.

## Padrão visual

| Propriedade      | Valor                                   |
| ----------------- | ---------------------------------------- |
| Tamanho do SVG    | 20–22px (`NavIconGraphic` usa 20 por padrão) |
| `strokeWidth`     | 2                                         |
| Estilo            | outline (não preenchido)                  |
| `stroke-linecap`  | round (padrão do lucide-react)            |
| `stroke-linejoin` | round (padrão do lucide-react)            |
| Container         | 36×36px, `border-radius: 8px` (`.ni-icon` / `.msb-icon`) |
| Cor — normal      | `var(--text-2)`                           |
| Cor — ativo/selecionado | `var(--teal)`                       |

A cor não é passada como prop do ícone: o SVG do lucide-react usa
`currentColor`, e quem define a cor é o CSS do container (`.ni-icon` /
`.msb-icon` e seus estados `.active`), em `Sidebar.css` e
`MobileSidebar.css`. Isso preserva hover, glow, borda e o indicador lateral
(`.nav-item.active::before`) que já existiam — nenhum deles foi alterado,
só ganharam a regra de `color`.

## Estados normal / hover / ativo

- **Normal**: fundo `rgba(255,255,255,0.03)`, borda `var(--border)`, ícone `var(--text-2)`.
- **Hover** (`.nav-item:hover .ni-icon`): fundo mais claro, borda `var(--border-md)` — inalterado por este sistema.
- **Ativo**: fundo `var(--teal-glow)`, borda `var(--teal-border)`, glow `box-shadow`, ícone `var(--teal)`.

## Relação ViewId → ícone

| ViewId          | Ícone Lucide           |
| ---------------- | ----------------------- |
| `registro`        | `Dumbbell`               |
| `dashboard`        | `ClipboardCheck`         |
| `performance`      | `ChartNoAxesCombined`    |
| `conquistas`       | `Trophy`                 |
| `banco`            | `Library`                |
| `clientes`         | `Users`                  |
| `notifications`    | `Bell`                   |
| `nova-semana`      | `CalendarSync`           |
| `saude`            | `HeartPulse`             |
| `forca`            | `Dumbbell`               |
| `cardio`           | `HeartPulse`             |
| `settings`         | `Settings`               |

`forca` e `cardio` compartilham `Dumbbell`/`HeartPulse` com `registro`/`saude`
respectivamente — não havia um ícone Lucide mais específico e distinto no
pedido original; se isso incomodar visualmente, é só trocar a entrada em
`VIEW_ICON_MAP`.

### Ícones de ação (fora de `ViewId`)

`ACTION_ICON_MAP` guarda ícones para ações de UI que não são uma view
(ex.: `logout` → `LogOut`). Hoje nada consome esse mapa ainda — o botão
"sair" do `UserMenu.tsx` continua como estava, fora do escopo desta etapa
(só Sidebar/MobileSidebar). Fica pronto para quando alguém quiser trocar o
texto "sair" por um ícone.

## Regra para adicionar um novo ícone

1. Se for um **ViewId novo**: adicione a entrada em `VIEW_ICON_MAP`
   (`iconMap.tsx`) importando o ícone do `lucide-react`. Nunca invente um
   `ViewId` só para ter onde pendurar um ícone — ele precisa existir primeiro
   em `src/types/view.ts`.
2. Se for uma **ação de UI** (não uma view): adicione em `ACTION_ICON_MAP`.
3. Não crie cores hardcoded — o ícone deve herdar `currentColor` e a cor vem
   sempre do CSS do container (token do tokens.css), nunca de uma prop
   `color` no componente do lucide-react.
4. Não use PNG/JPG para ícones de navegação.
