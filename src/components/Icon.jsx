// SVG sprite + Icon helper. Render <IconSprite /> once per page.
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <symbol id="home" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/></symbol>
        <symbol id="tag" viewBox="0 0 24 24"><path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.2"/></symbol>
        <symbol id="trophy" viewBox="0 0 24 24"><path d="M8 4h8v6a4 4 0 01-8 0zM8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 14v4M8 20h8"/></symbol>
        <symbol id="cog" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></symbol>
        <symbol id="gift" viewBox="0 0 24 24"><path d="M4 9h16v4H4zM5 13v8h14v-8M12 9v12M12 9S10 4 8 5s0 4 4 4zM12 9s2-5 4-4 0 4-4 4z"/></symbol>
        <symbol id="bag" viewBox="0 0 24 24"><path d="M3 4h3l2 12h10l2-9H7"/><circle cx="9" cy="20" r="1"/><circle cx="17" cy="20" r="1"/></symbol>
        <symbol id="slots" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M9 5v14M15 5v14"/></symbol>
        <symbol id="play" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></symbol>
        <symbol id="cal" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></symbol>
        <symbol id="users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6M16 4.5a3.5 3.5 0 010 7M19 14c2 1 3 3 3 6"/></symbol>
        <symbol id="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></symbol>
        <symbol id="left" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></symbol>
        <symbol id="right" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></symbol>
        <symbol id="search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></symbol>
        <symbol id="bell" viewBox="0 0 24 24"><path d="M6 17V11a6 6 0 0112 0v6l2 2H4zM10 21h4"/></symbol>
        <symbol id="chat" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></symbol>
        <symbol id="tv" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/></symbol>
        <symbol id="ball" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 5h-5L8 10z"/></symbol>
        <symbol id="wallet" viewBox="0 0 24 24"><path d="M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7l12-3v3M16 14h2"/></symbol>
        <symbol id="spark" viewBox="0 0 24 24"><path d="M12 3l2.2 6.3L21 12l-6.8 2.7L12 21l-2.2-6.3L3 12l6.8-2.7z"/></symbol>
        <symbol id="clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
        <symbol id="shield" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.500-1-8-4-8-9V6z"/></symbol>
        <symbol id="pulse" viewBox="0 0 24 24"><path d="M2 12h4l3-8 4 16 3-8h6"/></symbol>
        <symbol id="menu" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></symbol>
        <symbol id="camera" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></symbol>
        <symbol id="send" viewBox="0 0 24 24"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/></symbol>
        <symbol id="cards" viewBox="0 0 24 24"><rect x="4" y="5" width="11" height="15" rx="2"/><path d="M9 3h8a3 3 0 013 3v10"/></symbol>
      </defs>
    </svg>
  );
}

export function Icon({ name, size, color }) {
  const style = size || color ? { width: size, height: size, color } : undefined;
  return (
    <svg className="i" style={style}>
      <use href={`#${name}`} />
    </svg>
  );
}
