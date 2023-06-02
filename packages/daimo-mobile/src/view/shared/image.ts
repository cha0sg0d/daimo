const image = {
  ethLogo: `data:image/png;base64,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`,
};

export default image;