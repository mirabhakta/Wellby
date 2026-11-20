import { Component } from "react";
import PropTypes from "prop-types";

/**
 * Last-resort safety net. A crash in one component should not leave the user
 * with a blank page and no way back, especially mid-session.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Wellby UI error", error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div
        className="grid min-h-screen place-items-center p-6 font-body"
        style={{ background: "#FAF7F2", color: "#3D2B1F" }}
      >
        <div
          className="max-w-lg rounded-[32px] p-8 text-center shadow-lg"
          style={{ background: "#FFFFFF", border: "1px solid #E8DDD0" }}
        >
          <h1 className="font-display text-3xl">Something went sideways</h1>
          <p className="mt-3 text-sm leading-6" style={{ color: "#7A6555" }}>
            Wellby hit an unexpected error. Your saved sessions, breaks, and settings are still on this
            device.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-full px-5 py-3 font-bold"
            style={{ background: "#7A6555", color: "#FAF7F2" }}
          >
            Reload Wellby
          </button>
        </div>
      </div>
    );
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node
};
