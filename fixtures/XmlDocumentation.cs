namespace Stillpoint.Tools;

/// <summary>
/// Reads a snapshot without loading the assembly into the process.
/// Use <see cref="SnapshotReader"/> with <paramref name="path"/>.
/// </summary>
/// <remarks>
/// Paths may contain &amp; or &lt;escaped&gt; characters.
/// <para>Pass <see langword="null"/> to use the default snapshot.</para>
/// <!-- Keep internal notes quiet. -->
/// <code><![CDATA[reader.Read("sample.dll");]]></code>
/// </remarks>
public sealed class XmlDocumentation
{
    /// <summary>Read the names from a snapshot.</summary>
    /// <param name="path">The assembly path.</param>
    /// <param
    ///     name='limit'>The maximum number of names.</param>
    /// <typeparam name="TResult">The projected result type.</typeparam>
    /// <returns>A list of <typeparamref name="TResult"/> values.</returns>
    /// <exception cref="System.IO.IOException">The file cannot be read.</exception>
    public TResult Read<TResult>(string path, int limit) => default!;

    /** <summary>Block-style documentation uses the same colors.</summary> */
    public void Refresh() { }

    // An ordinary comment containing <summary> stays a comment.
}
