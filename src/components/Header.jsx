import React from 'react';

function Header() {
  return (
    <header>
      <nav className="navbar">
        <a href="/">
          <img src={'/images/logo.png'} alt="logo" className="logo"></img>
        </a>
        <a href="/" className="title">
          Fluxe
        </a>
        <div className="filler"></div>
      </nav>
    </header>
  );
}

export default Header;
