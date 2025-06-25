const InputBid = ({ className = "", type = "text", ...props }, ref) => {
  return (
    <input
      type={type}
      className={
        "flex h-10 w-full rounded-md border border-yellow-400 bg-slate-800 px-3 py-2 text-base pixelated-font text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 " +
        className
      }
      ref={ref}
      {...props}
    />
  );
};
InputBid.displayName = "InputBid";

export default InputBid;
