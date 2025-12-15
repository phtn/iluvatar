import type { ReactNode } from 'react'

type IconProps = Readonly<{
  className?: string
  title?: string
}>

function Svg(props: IconProps & { children: ReactNode; viewBox?: string }) {
  const { className, title, children, viewBox = '0 0 24 24' } = props
  return (
    <svg
      className={className}
      viewBox={viewBox}
      width='24'
      height='24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      aria-hidden={title ? undefined : true}
      aria-label={title}
      role={title ? 'img' : 'presentation'}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

export function IconMap(props: IconProps) {
  return (
    <Svg {...props} title={props.title ?? 'World'}>
      <path
        d='M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z'
        stroke='currentColor'
        strokeWidth='1.6'
      />
      <path
        d='M3.6 12h16.8M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinejoin='round'
      />
    </Svg>
  )
}

export function IconUsers(props: IconProps) {
  return (
    <Svg {...props} title={props.title ?? 'Players'}>
      <path
        d='M8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z'
        stroke='currentColor'
        strokeWidth='1.6'
      />
      <path
        d='M4.5 20c1.3-2.8 4-4.6 7.5-4.6S18.2 17.2 19.5 20'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinecap='round'
      />
    </Svg>
  )
}

export function IconBackpack(props: IconProps) {
  return (
    <Svg {...props} title={props.title ?? 'Inventory'}>
      <path
        d='M8 7a4 4 0 0 1 8 0v1'
        stroke='currentColor'
        strokeWidth='1.6'
      />
      <path
        d='M7 8h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3Z'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinejoin='round'
      />
      <path
        d='M9.5 14h5'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinecap='round'
      />
    </Svg>
  )
}

export function IconHammer(props: IconProps) {
  return (
    <Svg {...props} title={props.title ?? 'Crafting'}>
      <path
        d='M14 3 9 8l2 2 5-5-2-2Z'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinejoin='round'
      />
      <path
        d='M10 10 4 16l4 4 6-6-4-4Z'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinejoin='round'
      />
      <path
        d='M7 13 5 11'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinecap='round'
      />
    </Svg>
  )
}

export function IconMenu(props: IconProps) {
  return (
    <Svg {...props} title={props.title ?? 'Menu'}>
      <path d='M4 7h16M4 12h16M4 17h16' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
    </Svg>
  )
}

export function IconBolt(props: IconProps) {
  return (
    <Svg {...props} title={props.title ?? 'Activity'}>
      <path
        d='M13 2 4 14h7l-1 8 9-12h-7l1-8Z'
        stroke='currentColor'
        strokeWidth='1.6'
        strokeLinejoin='round'
      />
    </Svg>
  )
}


